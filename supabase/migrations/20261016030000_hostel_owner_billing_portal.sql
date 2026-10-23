ALTER TABLE public.owner_subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancel_requested_at timestamptz;

CREATE TABLE IF NOT EXISTS public.owner_subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_subscription_id uuid NOT NULL REFERENCES public.owner_subscriptions(id) ON DELETE CASCADE,
  hostel_id uuid NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
  hostel_owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  razorpay_order_id text UNIQUE,
  razorpay_payment_id text UNIQUE,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL,
  payment_method text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS owner_subscription_payments_hostel_paid_at_idx
  ON public.owner_subscription_payments(hostel_id, paid_at DESC);

ALTER TABLE public.owner_subscription_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_subscription_payments_owner_select" ON public.owner_subscription_payments;
CREATE POLICY "owner_subscription_payments_owner_select" ON public.owner_subscription_payments
  FOR SELECT TO authenticated
  USING (
    hostel_owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );
