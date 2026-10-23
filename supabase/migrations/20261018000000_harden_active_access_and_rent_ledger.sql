-- Require an active profile in every authorization helper. An unexpired Supabase
-- session must not retain application data access after an administrator disables
-- the profile.
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
    AND active = true;
$$;

CREATE OR REPLACE FUNCTION public.get_user_hostel_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT hostel_id
  FROM public.profiles
  WHERE id = auth.uid()
    AND active = true;
$$;

CREATE OR REPLACE FUNCTION public.is_hostel_staff(check_hostel_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.active = true
      AND (
        p.role = 'super_admin'
        OR EXISTS (
          SELECT 1
          FROM public.hostels h
          WHERE h.id = check_hostel_id
            AND h.owner_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.staff_members s
          WHERE s.hostel_id = check_hostel_id
            AND s.user_id = auth.uid()
            AND s.active = true
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_hostel(check_hostel_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.active = true
      AND (
        p.role = 'super_admin'
        OR EXISTS (
          SELECT 1
          FROM public.hostels h
          WHERE h.id = check_hostel_id
            AND h.owner_id = auth.uid()
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated;
REVOKE ALL ON FUNCTION public.get_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
REVOKE ALL ON FUNCTION public.get_user_hostel_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_hostel_id() TO authenticated;
REVOKE ALL ON FUNCTION public.is_hostel_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_hostel_staff(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.owns_hostel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_hostel(uuid) TO authenticated;

-- RLS policies are permissive by default, so replace policies that included a
-- direct auth.uid() branch; such branches must also reject inactive profiles.
DROP POLICY IF EXISTS "hostels_select" ON public.hostels;
CREATE POLICY "hostels_select" ON public.hostels FOR SELECT TO authenticated
  USING (
    public.is_active_user()
    AND (
      owner_id = auth.uid()
      OR public.get_user_role() = 'super_admin'
      OR public.is_hostel_staff(id)
      OR EXISTS (
        SELECT 1
        FROM public.tenants t
        WHERE t.hostel_id = hostels.id
          AND t.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "hostels_update" ON public.hostels;
CREATE POLICY "hostels_update" ON public.hostels FOR UPDATE TO authenticated
  USING (public.owns_hostel(id) AND public.hostel_billing_allows_writes(id))
  WITH CHECK (public.owns_hostel(id) AND public.hostel_billing_allows_writes(id));

-- Keep mutable hostel attributes explicit so a row owner cannot transfer
-- ownership or alter billing/AI configuration through a broad UPDATE grant.
REVOKE UPDATE ON public.hostels FROM PUBLIC, anon, authenticated;
GRANT UPDATE (
  name,
  address,
  city,
  state,
  total_floors,
  billing_day,
  currency
) ON public.hostels TO authenticated;

-- Hostel deletion is a destructive platform-admin action, not an owner-side
-- operation. The helper returns no role for inactive accounts.
DROP POLICY IF EXISTS "hostels_delete" ON public.hostels;
CREATE POLICY "hostels_delete" ON public.hostels FOR DELETE TO authenticated
  USING (public.get_user_role() = 'super_admin');

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (
    public.is_active_user()
    AND (
      id = auth.uid()
      OR public.get_user_role() = 'super_admin'
      OR public.is_hostel_staff(hostel_id)
    )
  );

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated
  USING (
    public.is_active_user()
    AND (id = auth.uid() OR public.get_user_role() = 'super_admin')
  )
  WITH CHECK (
    public.is_active_user()
    AND (id = auth.uid() OR public.get_user_role() = 'super_admin')
  );

-- A row-level policy cannot protect individual columns. Prevent clients from
-- changing role, active status, hostel assignment, email, or account identity.
-- Profile edits are limited to display name and phone; privileged profile
-- changes remain available only through trusted service-role routes.
REVOKE INSERT, UPDATE ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (full_name, phone) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "tenants_select" ON public.tenants;
CREATE POLICY "tenants_select" ON public.tenants FOR SELECT TO authenticated
  USING (
    public.is_active_user()
    AND (public.is_hostel_staff(hostel_id) OR user_id = auth.uid())
  );

DROP POLICY IF EXISTS "invoices_select" ON public.invoices;
CREATE POLICY "invoices_select" ON public.invoices FOR SELECT TO authenticated
  USING (
    public.is_active_user()
    AND (
      public.is_hostel_staff(hostel_id)
      OR EXISTS (
        SELECT 1
        FROM public.tenants t
        WHERE t.id = invoices.tenant_id
          AND t.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "payments_select" ON public.payments;
CREATE POLICY "payments_select" ON public.payments FOR SELECT TO authenticated
  USING (
    public.is_active_user()
    AND (
      public.is_hostel_staff(hostel_id)
      OR EXISTS (
        SELECT 1
        FROM public.tenants t
        WHERE t.id = payments.tenant_id
          AND t.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "complaints_select" ON public.complaints;
CREATE POLICY "complaints_select" ON public.complaints FOR SELECT TO authenticated
  USING (
    public.is_active_user()
    AND (
      public.is_hostel_staff(hostel_id)
      OR EXISTS (
        SELECT 1
        FROM public.tenants t
        WHERE t.id = complaints.tenant_id
          AND t.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "complaints_insert" ON public.complaints;
CREATE POLICY "complaints_insert" ON public.complaints FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_user()
    AND (
      public.is_hostel_staff(hostel_id)
      OR EXISTS (
        SELECT 1
        FROM public.tenants t
        WHERE t.id = complaints.tenant_id
          AND t.hostel_id = complaints.hostel_id
          AND t.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "staff_select" ON public.staff_members;
CREATE POLICY "staff_select" ON public.staff_members FOR SELECT TO authenticated
  USING (
    public.is_active_user()
    AND (
      public.owns_hostel(hostel_id)
      OR user_id = auth.uid()
    )
  );

-- Transactions and receipts are written only by trusted server routes and
-- payment webhooks. Client-created PENDING rows could reserve an invoice and
-- prevent the legitimate checkout flow from recording its order.
DROP POLICY IF EXISTS "rent_transactions_insert" ON public.rent_transactions;
DROP POLICY IF EXISTS "rent_transactions_owner_insert" ON public.rent_transactions;
DROP POLICY IF EXISTS "rent_transactions_tenant_access" ON public.rent_transactions;
CREATE POLICY "rent_transactions_tenant_access" ON public.rent_transactions
  FOR SELECT TO authenticated
  USING (
    public.is_active_user()
    AND (
      EXISTS (
        SELECT 1
        FROM public.tenants t
        WHERE t.id = rent_transactions.tenant_id
          AND t.user_id = auth.uid()
      )
      OR public.owns_hostel(hostel_id)
    )
  );

DROP POLICY IF EXISTS "payment_receipts_access" ON public.payment_receipts;
CREATE POLICY "payment_receipts_access" ON public.payment_receipts
  FOR SELECT TO authenticated
  USING (
    public.is_active_user()
    AND EXISTS (
      SELECT 1
      FROM public.rent_transactions rt
      WHERE rt.id = payment_receipts.transaction_id
        AND (
          public.owns_hostel(rt.hostel_id)
          OR EXISTS (
            SELECT 1
            FROM public.tenants t
            WHERE t.id = rt.tenant_id
              AND t.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "owner_payment_accounts_owner_select" ON public.owner_payment_accounts;
CREATE POLICY "owner_payment_accounts_owner_select" ON public.owner_payment_accounts
  FOR SELECT TO authenticated
  USING (
    public.is_active_user()
    AND (
      hostel_owner_id = auth.uid()
      OR public.get_user_role() = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "owner_subscriptions_owner_select" ON public.owner_subscriptions;
CREATE POLICY "owner_subscriptions_owner_select" ON public.owner_subscriptions
  FOR SELECT TO authenticated
  USING (
    public.is_active_user()
    AND (
      hostel_owner_id = auth.uid()
      OR public.get_user_role() = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "owner_subscription_payments_owner_select" ON public.owner_subscription_payments;
CREATE POLICY "owner_subscription_payments_owner_select" ON public.owner_subscription_payments
  FOR SELECT TO authenticated
  USING (
    public.is_active_user()
    AND (
      hostel_owner_id = auth.uid()
      OR public.get_user_role() = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "owners_read_own_hostel_onboarding_drafts"
  ON public.owner_hostel_onboarding_drafts;
CREATE POLICY "owners_read_own_hostel_onboarding_drafts"
  ON public.owner_hostel_onboarding_drafts
  FOR SELECT TO authenticated
  USING (public.is_active_user() AND owner_id = auth.uid());

-- Keep KYC files private, scoped to the active uploader, and bounded to common
-- image/PDF formats. This limits accidental public data exposure and upload abuse.
UPDATE storage.buckets
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp'
    ]
WHERE id = 'kyc-documents';

DROP POLICY IF EXISTS "kyc_upload" ON storage.objects;
CREATE POLICY "kyc_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_user()
    AND bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "kyc_read_own" ON storage.objects;
CREATE POLICY "kyc_read_own" ON storage.objects FOR SELECT TO authenticated
  USING (
    public.is_active_user()
    AND bucket_id = 'kyc-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (
        (storage.foldername(name))[1] = 'kyc'
        AND (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

DROP POLICY IF EXISTS "kyc_update_own" ON storage.objects;
CREATE POLICY "kyc_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (
    public.is_active_user()
    AND bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    public.is_active_user()
    AND bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "kyc_delete_own" ON storage.objects;
CREATE POLICY "kyc_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (
    public.is_active_user()
    AND bucket_id = 'kyc-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (
        (storage.foldername(name))[1] = 'kyc'
        AND (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );
