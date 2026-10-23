-- -------------------------------------------------------------------------------
-- MIGRATION: Daily Expenses & Operational Ledger Module
-- Created: 2026-10-08
-- Description: Adds the `expenses` table so hostel owners and caretakers can
--              log day-wise operational expenses (electricity, groceries, repairs,
--              salaries, etc.) and maintain a paperless financial ledger.
-- -------------------------------------------------------------------------------

-- 1. Create the expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id            UUID          NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  expense_title        VARCHAR(255)  NOT NULL,
  category_type        VARCHAR(50)   NOT NULL DEFAULT 'CUSTOM',
  custom_category_name VARCHAR(100),
  amount               DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  payment_method       VARCHAR(20)   NOT NULL DEFAULT 'CASH',
  expense_date         DATE          NOT NULL DEFAULT CURRENT_DATE,
  logged_by_role       VARCHAR(20)   NOT NULL DEFAULT 'OWNER',
  logged_by_user_id    UUID          REFERENCES auth.users(id),
  receipt_url          TEXT,
  notes                TEXT,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS expenses_hostel_id_idx    ON expenses (hostel_id);
CREATE INDEX IF NOT EXISTS expenses_date_idx         ON expenses (expense_date DESC);
CREATE INDEX IF NOT EXISTS expenses_category_idx     ON expenses (category_type);
CREATE INDEX IF NOT EXISTS expenses_method_idx       ON expenses (payment_method);

-- 3. Auto-update updated_at
CREATE OR REPLACE FUNCTION update_expenses_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expenses_updated_at ON expenses;
CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_expenses_updated_at();

-- 4. Enable RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- 5. Owner full access
CREATE POLICY "expenses_owner_all" ON expenses
  FOR ALL
  USING (
    hostel_id IN (SELECT id FROM hostels WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    hostel_id IN (SELECT id FROM hostels WHERE owner_id = auth.uid())
  );

-- 6. Caretaker: can read
CREATE POLICY "expenses_caretaker_select" ON expenses
  FOR SELECT
  USING (
    hostel_id IN (SELECT hostel_id FROM profiles WHERE id = auth.uid() AND role = 'caretaker')
  );

-- 7. Caretaker: can insert
CREATE POLICY "expenses_caretaker_insert" ON expenses
  FOR INSERT
  WITH CHECK (
    hostel_id IN (SELECT hostel_id FROM profiles WHERE id = auth.uid() AND role = 'caretaker')
  );
