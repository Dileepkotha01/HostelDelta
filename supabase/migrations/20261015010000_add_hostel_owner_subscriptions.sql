ALTER TABLE public.owner_subscriptions
  ADD COLUMN IF NOT EXISTS hostel_id uuid REFERENCES public.hostels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS onboarding_id uuid,
  ADD COLUMN IF NOT EXISTS trial_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS authorized_at timestamptz,
  ADD COLUMN IF NOT EXISTS razorpay_customer_id text,
  ADD COLUMN IF NOT EXISTS payment_method text;

CREATE UNIQUE INDEX IF NOT EXISTS owner_subscriptions_onboarding_id_key
  ON public.owner_subscriptions(onboarding_id)
  WHERE onboarding_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS owner_subscriptions_hostel_id_key
  ON public.owner_subscriptions(hostel_id)
  WHERE hostel_id IS NOT NULL;

DROP POLICY IF EXISTS "owner_subscriptions_owner_access" ON public.owner_subscriptions;
CREATE POLICY "owner_subscriptions_owner_select" ON public.owner_subscriptions
  FOR SELECT TO authenticated
  USING (
    hostel_owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );
