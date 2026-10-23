/*
# Enforce hostel billing on writes + harden open policies

1. Adds hostel_billing_allows_writes() used by operational write policies.
2. Blocks owner/staff mutations when subscription is inactive/expired/missing.
3. Super-admins remain unrestricted.
4. Removes any residual open UPDATE/INSERT policies on payment ledgers.
*/

CREATE OR REPLACE FUNCTION public.hostel_billing_allows_writes(check_hostel_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
        AND active = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.owner_subscriptions s
      WHERE s.hostel_id = check_hostel_id
        AND (
          (s.status = 'ACTIVE' AND s.current_period_end IS NOT NULL AND s.current_period_end > now())
          OR (s.status = 'TRIALING' AND s.trial_ends_at IS NOT NULL AND s.trial_ends_at > now())
          OR (s.status = 'CANCELLED' AND s.current_period_end IS NOT NULL AND s.current_period_end > now())
        )
    );
$$;

REVOKE ALL ON FUNCTION public.hostel_billing_allows_writes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hostel_billing_allows_writes(uuid) TO authenticated;

-- Linked residents may read their own hostel (not mutate it).
DROP POLICY IF EXISTS "hostels_select" ON public.hostels;
CREATE POLICY "hostels_select" ON public.hostels FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR get_user_role() = 'super_admin'
    OR is_hostel_staff(id)
    OR EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.hostel_id = hostels.id AND t.user_id = auth.uid()
    )
  );

-- FLOORS
DROP POLICY IF EXISTS "floors_insert" ON public.floors;
CREATE POLICY "floors_insert" ON public.floors FOR INSERT TO authenticated
  WITH CHECK (owns_hostel(hostel_id) AND hostel_billing_allows_writes(hostel_id));
DROP POLICY IF EXISTS "floors_update" ON public.floors;
CREATE POLICY "floors_update" ON public.floors FOR UPDATE TO authenticated
  USING (owns_hostel(hostel_id) AND hostel_billing_allows_writes(hostel_id))
  WITH CHECK (owns_hostel(hostel_id) AND hostel_billing_allows_writes(hostel_id));
DROP POLICY IF EXISTS "floors_delete" ON public.floors;
CREATE POLICY "floors_delete" ON public.floors FOR DELETE TO authenticated
  USING (owns_hostel(hostel_id) AND hostel_billing_allows_writes(hostel_id));

-- ROOMS
DROP POLICY IF EXISTS "rooms_insert" ON public.rooms;
CREATE POLICY "rooms_insert" ON public.rooms FOR INSERT TO authenticated
  WITH CHECK (owns_hostel(hostel_id) AND hostel_billing_allows_writes(hostel_id));
DROP POLICY IF EXISTS "rooms_update" ON public.rooms;
CREATE POLICY "rooms_update" ON public.rooms FOR UPDATE TO authenticated
  USING (owns_hostel(hostel_id) AND hostel_billing_allows_writes(hostel_id))
  WITH CHECK (owns_hostel(hostel_id) AND hostel_billing_allows_writes(hostel_id));
DROP POLICY IF EXISTS "rooms_delete" ON public.rooms;
CREATE POLICY "rooms_delete" ON public.rooms FOR DELETE TO authenticated
  USING (owns_hostel(hostel_id) AND hostel_billing_allows_writes(hostel_id));

-- BEDS
DROP POLICY IF EXISTS "beds_insert" ON public.beds;
CREATE POLICY "beds_insert" ON public.beds FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rooms r
      WHERE r.id = room_id
        AND owns_hostel(r.hostel_id)
        AND hostel_billing_allows_writes(r.hostel_id)
    )
  );
DROP POLICY IF EXISTS "beds_update" ON public.beds;
CREATE POLICY "beds_update" ON public.beds FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rooms r
      WHERE r.id = room_id
        AND owns_hostel(r.hostel_id)
        AND hostel_billing_allows_writes(r.hostel_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rooms r
      WHERE r.id = room_id
        AND owns_hostel(r.hostel_id)
        AND hostel_billing_allows_writes(r.hostel_id)
    )
  );
DROP POLICY IF EXISTS "beds_delete" ON public.beds;
CREATE POLICY "beds_delete" ON public.beds FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rooms r
      WHERE r.id = room_id
        AND owns_hostel(r.hostel_id)
        AND hostel_billing_allows_writes(r.hostel_id)
    )
  );

-- TENANTS
DROP POLICY IF EXISTS "tenants_insert" ON public.tenants;
CREATE POLICY "tenants_insert" ON public.tenants FOR INSERT TO authenticated
  WITH CHECK (is_hostel_staff(hostel_id) AND hostel_billing_allows_writes(hostel_id));
DROP POLICY IF EXISTS "tenants_update" ON public.tenants;
CREATE POLICY "tenants_update" ON public.tenants FOR UPDATE TO authenticated
  USING (is_hostel_staff(hostel_id) AND hostel_billing_allows_writes(hostel_id))
  WITH CHECK (is_hostel_staff(hostel_id) AND hostel_billing_allows_writes(hostel_id));
DROP POLICY IF EXISTS "tenants_delete" ON public.tenants;
CREATE POLICY "tenants_delete" ON public.tenants FOR DELETE TO authenticated
  USING (is_hostel_staff(hostel_id) AND hostel_billing_allows_writes(hostel_id));

-- INVOICES
DROP POLICY IF EXISTS "invoices_insert" ON public.invoices;
CREATE POLICY "invoices_insert" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (is_hostel_staff(hostel_id) AND hostel_billing_allows_writes(hostel_id));
DROP POLICY IF EXISTS "invoices_update" ON public.invoices;
CREATE POLICY "invoices_update" ON public.invoices FOR UPDATE TO authenticated
  USING (is_hostel_staff(hostel_id) AND hostel_billing_allows_writes(hostel_id))
  WITH CHECK (is_hostel_staff(hostel_id) AND hostel_billing_allows_writes(hostel_id));
DROP POLICY IF EXISTS "invoices_delete" ON public.invoices;
CREATE POLICY "invoices_delete" ON public.invoices FOR DELETE TO authenticated
  USING (is_hostel_staff(hostel_id) AND hostel_billing_allows_writes(hostel_id));

-- PAYMENTS
DROP POLICY IF EXISTS "payments_insert" ON public.payments;
CREATE POLICY "payments_insert" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (is_hostel_staff(hostel_id) AND hostel_billing_allows_writes(hostel_id));
DROP POLICY IF EXISTS "payments_update" ON public.payments;
CREATE POLICY "payments_update" ON public.payments FOR UPDATE TO authenticated
  USING (is_hostel_staff(hostel_id) AND hostel_billing_allows_writes(hostel_id))
  WITH CHECK (is_hostel_staff(hostel_id) AND hostel_billing_allows_writes(hostel_id));
DROP POLICY IF EXISTS "payments_delete" ON public.payments;
CREATE POLICY "payments_delete" ON public.payments FOR DELETE TO authenticated
  USING (is_hostel_staff(hostel_id) AND hostel_billing_allows_writes(hostel_id));

-- COMPLAINTS
DROP POLICY IF EXISTS "complaints_insert" ON public.complaints;
CREATE POLICY "complaints_insert" ON public.complaints FOR INSERT TO authenticated
  WITH CHECK (is_hostel_staff(hostel_id) AND hostel_billing_allows_writes(hostel_id));
DROP POLICY IF EXISTS "complaints_update" ON public.complaints;
CREATE POLICY "complaints_update" ON public.complaints FOR UPDATE TO authenticated
  USING (is_hostel_staff(hostel_id) AND hostel_billing_allows_writes(hostel_id))
  WITH CHECK (is_hostel_staff(hostel_id) AND hostel_billing_allows_writes(hostel_id));
DROP POLICY IF EXISTS "complaints_delete" ON public.complaints;
CREATE POLICY "complaints_delete" ON public.complaints FOR DELETE TO authenticated
  USING (is_hostel_staff(hostel_id) AND hostel_billing_allows_writes(hostel_id));

-- MAINTENANCE
DROP POLICY IF EXISTS "maintenance_insert" ON public.maintenance_tasks;
CREATE POLICY "maintenance_insert" ON public.maintenance_tasks FOR INSERT TO authenticated
  WITH CHECK (is_hostel_staff(hostel_id) AND hostel_billing_allows_writes(hostel_id));
DROP POLICY IF EXISTS "maintenance_update" ON public.maintenance_tasks;
CREATE POLICY "maintenance_update" ON public.maintenance_tasks FOR UPDATE TO authenticated
  USING (is_hostel_staff(hostel_id) AND hostel_billing_allows_writes(hostel_id))
  WITH CHECK (is_hostel_staff(hostel_id) AND hostel_billing_allows_writes(hostel_id));
DROP POLICY IF EXISTS "maintenance_delete" ON public.maintenance_tasks;
CREATE POLICY "maintenance_delete" ON public.maintenance_tasks FOR DELETE TO authenticated
  USING (owns_hostel(hostel_id) AND hostel_billing_allows_writes(hostel_id));

-- AI CALL LOGS
DROP POLICY IF EXISTS "ai_calls_insert" ON public.ai_call_logs;
CREATE POLICY "ai_calls_insert" ON public.ai_call_logs FOR INSERT TO authenticated
  WITH CHECK (is_hostel_staff(hostel_id) AND hostel_billing_allows_writes(hostel_id));
DROP POLICY IF EXISTS "ai_calls_update" ON public.ai_call_logs;
CREATE POLICY "ai_calls_update" ON public.ai_call_logs FOR UPDATE TO authenticated
  USING (is_hostel_staff(hostel_id) AND hostel_billing_allows_writes(hostel_id))
  WITH CHECK (is_hostel_staff(hostel_id) AND hostel_billing_allows_writes(hostel_id));
DROP POLICY IF EXISTS "ai_calls_delete" ON public.ai_call_logs;
CREATE POLICY "ai_calls_delete" ON public.ai_call_logs FOR DELETE TO authenticated
  USING (is_hostel_staff(hostel_id) AND hostel_billing_allows_writes(hostel_id));

-- STAFF
DROP POLICY IF EXISTS "staff_insert" ON public.staff_members;
CREATE POLICY "staff_insert" ON public.staff_members FOR INSERT TO authenticated
  WITH CHECK (owns_hostel(hostel_id) AND hostel_billing_allows_writes(hostel_id));
DROP POLICY IF EXISTS "staff_update" ON public.staff_members;
CREATE POLICY "staff_update" ON public.staff_members FOR UPDATE TO authenticated
  USING (owns_hostel(hostel_id) AND hostel_billing_allows_writes(hostel_id))
  WITH CHECK (owns_hostel(hostel_id) AND hostel_billing_allows_writes(hostel_id));
DROP POLICY IF EXISTS "staff_delete" ON public.staff_members;
CREATE POLICY "staff_delete" ON public.staff_members FOR DELETE TO authenticated
  USING (owns_hostel(hostel_id) AND hostel_billing_allows_writes(hostel_id));

-- HOSTEL CREATE/UPDATE
-- Client inserts are limited to super-admins. Owner hostels are provisioned via
-- privileged server routes after payment verification.
DROP POLICY IF EXISTS "hostels_insert" ON public.hostels;
CREATE POLICY "hostels_insert" ON public.hostels FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'super_admin');
DROP POLICY IF EXISTS "hostels_update" ON public.hostels;
CREATE POLICY "hostels_update" ON public.hostels FOR UPDATE TO authenticated
  USING (
    (owner_id = auth.uid() AND hostel_billing_allows_writes(id))
    OR get_user_role() = 'super_admin'
  )
  WITH CHECK (
    (owner_id = auth.uid() AND hostel_billing_allows_writes(id))
    OR get_user_role() = 'super_admin'
  );

-- EXPENSES (if table exists)
DO $$
BEGIN
  IF to_regclass('public.expenses') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "expenses_owner_all" ON public.expenses';
    EXECUTE $policy$
      CREATE POLICY "expenses_owner_all" ON public.expenses
        FOR ALL TO authenticated
        USING (owns_hostel(hostel_id) AND hostel_billing_allows_writes(hostel_id))
        WITH CHECK (owns_hostel(hostel_id) AND hostel_billing_allows_writes(hostel_id))
    $policy$;

    EXECUTE 'DROP POLICY IF EXISTS "expenses_caretaker_insert" ON public.expenses';
    EXECUTE $policy$
      CREATE POLICY "expenses_caretaker_insert" ON public.expenses
        FOR INSERT TO authenticated
        WITH CHECK (is_hostel_staff(hostel_id) AND hostel_billing_allows_writes(hostel_id))
    $policy$;
  END IF;
END $$;

-- Harden rent ledger: no authenticated UPDATE/INSERT bypasses
DROP POLICY IF EXISTS "rent_transactions_service_update" ON public.rent_transactions;
DROP POLICY IF EXISTS "rent_transactions_insert" ON public.rent_transactions;
CREATE POLICY "rent_transactions_owner_insert" ON public.rent_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      hostel_id IN (SELECT id FROM public.hostels WHERE owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
    )
    AND hostel_billing_allows_writes(hostel_id)
  );

DROP POLICY IF EXISTS "payment_receipts_service_insert" ON public.payment_receipts;
