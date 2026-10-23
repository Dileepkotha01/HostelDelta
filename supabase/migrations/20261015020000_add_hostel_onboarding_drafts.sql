CREATE TABLE IF NOT EXISTS public.owner_hostel_onboarding_drafts (
  onboarding_id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hostel_name text NOT NULL,
  draft jsonb NOT NULL,
  status text NOT NULL DEFAULT 'PENDING_PAYMENT'
    CHECK (status IN ('PENDING_PAYMENT', 'PROCESSING', 'PAYMENT_FAILED', 'COMPLETED')),
  last_notified_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS owner_hostel_onboarding_drafts_owner_pending_idx
  ON public.owner_hostel_onboarding_drafts(owner_id, updated_at DESC)
  WHERE status <> 'COMPLETED';

ALTER TABLE public.hostels
  ADD COLUMN IF NOT EXISTS onboarding_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS hostels_onboarding_id_key
  ON public.hostels(onboarding_id)
  WHERE onboarding_id IS NOT NULL;

ALTER TABLE public.owner_hostel_onboarding_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners_read_own_hostel_onboarding_drafts"
  ON public.owner_hostel_onboarding_drafts;
CREATE POLICY "owners_read_own_hostel_onboarding_drafts"
  ON public.owner_hostel_onboarding_drafts
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());
