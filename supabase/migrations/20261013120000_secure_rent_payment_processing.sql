ALTER TABLE public.rent_transactions
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_category text DEFAULT 'tenant_rent',
  ADD COLUMN IF NOT EXISTS gateway_order_id text;

UPDATE public.owner_payment_accounts
SET verification_status = 'PENDING_VERIFICATION'
WHERE verification_status IS DISTINCT FROM 'PENDING_VERIFICATION';

ALTER TABLE public.owner_payment_accounts
  DROP COLUMN IF EXISTS bank_account_number,
  DROP COLUMN IF EXISTS ifsc_code,
  DROP COLUMN IF EXISTS beneficiary_name;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.rent_transactions'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) IN (
        'UNIQUE (tenant_id, rent_month, rent_year)',
        'UNIQUE (invoice_id)'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.rent_transactions DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rent_transactions_active_invoice
  ON public.rent_transactions(invoice_id)
  WHERE invoice_id IS NOT NULL AND status IN ('PENDING', 'PAID');

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_gateway_order_id_unique
  ON public.payments(gateway_order_id)
  WHERE gateway_order_id IS NOT NULL;

DROP POLICY IF EXISTS "owner_payment_accounts_owner_access" ON public.owner_payment_accounts;
CREATE POLICY "owner_payment_accounts_owner_select" ON public.owner_payment_accounts
  FOR SELECT TO authenticated
  USING (
    hostel_id IN (SELECT id FROM public.hostels WHERE owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS "rent_transactions_service_update" ON public.rent_transactions;
DROP POLICY IF EXISTS "payment_receipts_service_insert" ON public.payment_receipts;

CREATE OR REPLACE FUNCTION public.process_rent_payment(
  p_order_id text,
  p_payment_id text,
  p_paid_amount numeric,
  p_bank_utr text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_transaction public.rent_transactions%ROWTYPE;
  v_invoice public.invoices%ROWTYPE;
  v_new_amount_paid numeric(12,2);
  v_hostel public.hostels%ROWTYPE;
  v_tenant public.tenants%ROWTYPE;
BEGIN
  SELECT * INTO v_transaction
  FROM public.rent_transactions
  WHERE razorpay_order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rent transaction not found for order %', p_order_id;
  END IF;

  IF v_transaction.status = 'PAID' THEN
    IF v_transaction.razorpay_payment_id = p_payment_id THEN
      RETURN false;
    END IF;
    RAISE EXCEPTION 'Order % was already completed with a different payment', p_order_id;
  END IF;

  IF v_transaction.status <> 'PENDING' OR v_transaction.invoice_id IS NULL THEN
    RAISE EXCEPTION 'Rent transaction is not payable';
  END IF;

  IF round(p_paid_amount, 2) <> round(v_transaction.total_amount, 2) THEN
    RAISE EXCEPTION 'Captured amount does not match the rent transaction';
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = v_transaction.invoice_id
    AND tenant_id = v_transaction.tenant_id
    AND hostel_id = v_transaction.hostel_id
  FOR UPDATE;

  IF NOT FOUND OR v_invoice.status = 'paid' THEN
    RAISE EXCEPTION 'Invoice is unavailable or already paid';
  END IF;

  v_new_amount_paid := COALESCE(v_invoice.amount_paid, 0) + p_paid_amount;
  IF v_new_amount_paid > v_invoice.amount THEN
    RAISE EXCEPTION 'Captured payment exceeds the invoice balance';
  END IF;

  INSERT INTO public.payments (
    invoice_id, tenant_id, hostel_id, amount, method, status,
    transaction_id, payment_category, gateway_order_id, notes
  ) VALUES (
    v_invoice.id, v_transaction.tenant_id, v_transaction.hostel_id,
    p_paid_amount, 'razorpay', 'completed', p_payment_id,
    'tenant_rent', p_order_id, p_bank_utr
  );

  UPDATE public.invoices
  SET amount_paid = v_new_amount_paid,
      status = CASE WHEN v_new_amount_paid = amount THEN 'paid'::public.invoice_status
                    ELSE 'partial'::public.invoice_status END,
      updated_at = now()
  WHERE id = v_invoice.id;

  UPDATE public.rent_transactions
  SET status = 'PAID',
      paid_at = now(),
      payment_method = 'razorpay',
      razorpay_payment_id = p_payment_id,
      bank_utr = p_bank_utr
  WHERE id = v_transaction.id;

  SELECT * INTO v_hostel FROM public.hostels WHERE id = v_transaction.hostel_id;
  SELECT * INTO v_tenant FROM public.tenants WHERE id = v_transaction.tenant_id;

  INSERT INTO public.payment_receipts (
    receipt_number, transaction_id, hostel_name, hostel_address, hostel_phone, hostel_gstin,
    tenant_name, tenant_phone, tenant_email, room_number, rent_month, rent_year,
    amount_paid, payment_method, razorpay_payment_id, bank_utr
  ) VALUES (
    'RCPT-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
    v_transaction.id, v_hostel.name, COALESCE(v_hostel.address, 'Address Not Provided'),
    COALESCE(v_hostel.phone, 'Phone Not Provided'), v_hostel.gstin,
    v_tenant.full_name, v_tenant.phone, v_tenant.email, v_transaction.room_number,
    v_transaction.rent_month, v_transaction.rent_year, p_paid_amount,
    'razorpay', p_payment_id, p_bank_utr
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.process_rent_payment(text, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_rent_payment(text, text, numeric, text) TO service_role;

CREATE OR REPLACE FUNCTION public.set_profile_role(
  p_target_user_id uuid,
  p_role public.user_role,
  p_actor_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_role public.user_role;
  v_active_admin_count bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('profile-role-admin-guard'));

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_actor_user_id AND role = 'super_admin' AND active = true
  ) THEN
    RAISE EXCEPTION 'Active super-admin access is required';
  END IF;

  IF p_target_user_id = p_actor_user_id THEN
    RAISE EXCEPTION 'Administrators cannot change their own role';
  END IF;

  SELECT role INTO v_current_role
  FROM public.profiles
  WHERE id = p_target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target profile does not exist';
  END IF;

  IF v_current_role = 'super_admin' AND p_role <> 'super_admin' THEN
    SELECT count(*) INTO v_active_admin_count
    FROM public.profiles
    WHERE role = 'super_admin' AND active = true;

    IF v_active_admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last active super-admin';
    END IF;
  END IF;

  UPDATE public.profiles SET role = p_role WHERE id = p_target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_profile_role(uuid, public.user_role, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_profile_role(uuid, public.user_role, uuid) TO service_role;
