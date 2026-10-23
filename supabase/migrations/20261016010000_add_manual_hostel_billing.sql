ALTER TABLE public.owner_subscriptions
  ALTER COLUMN razorpay_subscription_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS razorpay_order_id text,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id text,
  ADD COLUMN IF NOT EXISTS billing_mode text NOT NULL DEFAULT 'AUTO_PAY'
    CHECK (billing_mode IN ('AUTO_PAY', 'ONE_TIME'));

CREATE UNIQUE INDEX IF NOT EXISTS owner_subscriptions_razorpay_order_id_key
  ON public.owner_subscriptions(razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS owner_subscriptions_razorpay_payment_id_key
  ON public.owner_subscriptions(razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;
