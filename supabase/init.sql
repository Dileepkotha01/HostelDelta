/*
# Kupera - Complete & Idempotent Database Schema
# Multi-tenant Hostel Management Platform (kupera.in)
# Compatible with Supabase SQL Editor (100% idempotent & safe to rerun)
#
# Setup note: this file is a standalone schema snapshot, not a migration.
# For new projects use the ordered files in supabase/migrations/ instead.
# Do not run this file in addition to those migrations; the migrations are
# the source of truth and include later schema/security changes.

## Overview
Supports 4 user roles: super_admin, hostel_owner, caretaker, tenant.
Includes complete schema for:
1. Core Hostels, Floors, Rooms, Beds, Tenants
2. Invoices, Payments (Rent & Gateway Tracking)
3. Owner Razorpay Payment Accounts & Subscriptions
4. Daily Operational Expenses & Financial Ledger
5. Complaints, Maintenance, Staff, AI Call Logs
6. KYC Storage Bucket & Strict RLS Policies
*/

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============ 1. ENUM TYPES (Idempotent) ============
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('super_admin', 'hostel_owner', 'caretaker', 'tenant'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE room_status AS ENUM ('vacant', 'occupied', 'maintenance'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE bed_status AS ENUM ('vacant', 'occupied', 'maintenance'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE room_type AS ENUM ('single', 'double', 'triple'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE tenant_status AS ENUM ('active', 'inactive', 'on_leave'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE invoice_status AS ENUM ('pending', 'partial', 'paid', 'overdue'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payment_method AS ENUM ('cash', 'upi', 'card', 'bank_transfer', 'razorpay', 'stripe'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE complaint_status AS ENUM ('open', 'in_progress', 'resolved', 'closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE complaint_priority AS ENUM ('low', 'medium', 'high'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE maintenance_task_type AS ENUM ('cleaning', 'repair', 'inspection'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE maintenance_status AS ENUM ('pending', 'in_progress', 'completed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE ai_call_status AS ENUM ('scheduled', 'in_progress', 'promised_to_pay', 'call_failed', 'escalated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE staff_role AS ENUM ('caretaker', 'warden'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ 2. CORE TABLES ============

-- Hostels
CREATE TABLE IF NOT EXISTS hostels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  city text,
  state text,
  phone text,
  email text,
  gstin text,
  total_floors int DEFAULT 1,
  total_rooms int DEFAULT 0,
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  billing_day int DEFAULT 1,
  currency text DEFAULT 'INR',
  voice_ai_provider text DEFAULT 'none',
  voice_ai_config jsonb DEFAULT '{}'::jsonb,
  amenities jsonb DEFAULT '{}'::jsonb,
  food_details text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Profiles (Extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role user_role NOT NULL DEFAULT 'hostel_owner',
  phone text,
  hostel_id uuid REFERENCES hostels(id) ON DELETE SET NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Floors
CREATE TABLE IF NOT EXISTS floors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id uuid NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  floor_number int NOT NULL,
  name text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(hostel_id, floor_number)
);

-- Rooms
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id uuid NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  floor_id uuid REFERENCES floors(id) ON DELETE SET NULL,
  room_number text NOT NULL,
  room_type room_type DEFAULT 'single',
  capacity int DEFAULT 1,
  monthly_rent numeric(12,2) DEFAULT 0,
  status room_status DEFAULT 'vacant',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(hostel_id, room_number)
);

-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id uuid NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  emergency_contact_name text,
  emergency_contact_phone text,
  id_proof_type text DEFAULT 'aadhaar',
  id_proof_url text,
  agreement_start date,
  agreement_end date,
  security_deposit numeric(12,2) DEFAULT 0,
  monthly_rent numeric(12,2) DEFAULT 0,
  rent_due_day int DEFAULT 1,
  status tenant_status DEFAULT 'active',
  assigned_bed_id uuid,
  pause_ai_calls boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Beds
CREATE TABLE IF NOT EXISTS beds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  bed_label text NOT NULL,
  status bed_status DEFAULT 'vacant',
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(room_id, bed_label)
);

-- Safe foreign key from tenants.assigned_bed_id to beds(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_assigned_bed_id_fkey'
  ) THEN
    ALTER TABLE tenants ADD CONSTRAINT tenants_assigned_bed_id_fkey
      FOREIGN KEY (assigned_bed_id) REFERENCES beds(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id uuid NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_number text UNIQUE NOT NULL,
  billing_month int NOT NULL,
  billing_year int NOT NULL,
  amount numeric(12,2) NOT NULL,
  amount_paid numeric(12,2) DEFAULT 0,
  due_date date NOT NULL,
  status invoice_status DEFAULT 'pending',
  payment_link text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  hostel_id uuid NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  method payment_method NOT NULL,
  status payment_status DEFAULT 'pending',
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  transaction_id text,
  payment_category text DEFAULT 'tenant_rent',
  gateway_order_id text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Complaints
CREATE TABLE IF NOT EXISTS complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id uuid NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text DEFAULT 'other',
  status complaint_status DEFAULT 'open',
  priority complaint_priority DEFAULT 'medium',
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

-- Maintenance Tasks
CREATE TABLE IF NOT EXISTS maintenance_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id uuid NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  bed_id uuid REFERENCES beds(id) ON DELETE SET NULL,
  task_type maintenance_task_type DEFAULT 'cleaning',
  status maintenance_status DEFAULT 'pending',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- AI Call Logs
CREATE TABLE IF NOT EXISTS ai_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id uuid NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  call_status ai_call_status DEFAULT 'scheduled',
  provider text DEFAULT 'vapi',
  provider_call_id text,
  tenant_name text,
  amount_due numeric(12,2) DEFAULT 0,
  days_overdue int DEFAULT 0,
  payment_link text,
  promised_pay_date date,
  call_duration_sec int,
  call_transcript text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Staff Members
CREATE TABLE IF NOT EXISTS staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id uuid NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role staff_role NOT NULL DEFAULT 'caretaker',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(hostel_id, user_id)
);

-- ============ 3. PAYMENT & SUBSCRIPTION TABLES ============

-- Owner Razorpay Linked Accounts
CREATE TABLE IF NOT EXISTS owner_payment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  hostel_id UUID REFERENCES hostels(id) ON DELETE CASCADE,
  razorpay_account_id VARCHAR(255) UNIQUE NOT NULL,
  verification_status VARCHAR(50) DEFAULT 'PENDING_VERIFICATION',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Owner SaaS Platform Subscriptions
CREATE TABLE IF NOT EXISTS owner_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  hostel_id UUID REFERENCES hostels(id) ON DELETE SET NULL,
  onboarding_id UUID,
  razorpay_subscription_id VARCHAR(255) UNIQUE,
  razorpay_order_id VARCHAR(255) UNIQUE,
  razorpay_payment_id VARCHAR(255) UNIQUE,
  billing_mode VARCHAR(20) NOT NULL DEFAULT 'AUTO_PAY'
    CHECK (billing_mode IN ('AUTO_PAY', 'ONE_TIME')),
  plan_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'CREATED',
  trial_starts_at TIMESTAMP WITH TIME ZONE,
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  authorized_at TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  razorpay_customer_id VARCHAR(255),
  payment_method VARCHAR(50),
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  cancel_requested_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS owner_subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_subscription_id UUID NOT NULL REFERENCES owner_subscriptions(id) ON DELETE CASCADE,
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  hostel_owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL,
  payment_method TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS owner_subscription_payments_hostel_paid_at_idx
  ON owner_subscription_payments(hostel_id, paid_at DESC);

-- Tenant Rent Ledger & Payment Transactions
CREATE TABLE IF NOT EXISTS rent_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  hostel_id UUID REFERENCES hostels(id) ON DELETE CASCADE,
  room_number VARCHAR(50) NOT NULL,
  rent_month VARCHAR(20) NOT NULL,
  rent_year INT NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  razorpay_order_id VARCHAR(255) UNIQUE,
  razorpay_payment_id VARCHAR(255) UNIQUE,
  payment_method VARCHAR(50),
  bank_utr VARCHAR(255),
  status VARCHAR(50) DEFAULT 'PENDING',
  is_autopay BOOLEAN DEFAULT FALSE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
);

-- Generated Payment Receipts
CREATE TABLE IF NOT EXISTS payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number VARCHAR(100) UNIQUE NOT NULL,
  transaction_id UUID REFERENCES rent_transactions(id) ON DELETE CASCADE,
  hostel_name VARCHAR(255) NOT NULL,
  hostel_address TEXT NOT NULL,
  hostel_phone VARCHAR(20) NOT NULL,
  hostel_gstin VARCHAR(50),
  tenant_name VARCHAR(255) NOT NULL,
  tenant_phone VARCHAR(20) NOT NULL,
  tenant_email VARCHAR(255),
  room_number VARCHAR(50) NOT NULL,
  rent_month VARCHAR(20) NOT NULL,
  rent_year INT NOT NULL,
  amount_paid DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  razorpay_payment_id VARCHAR(255) NOT NULL,
  bank_utr VARCHAR(255),
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily Operational Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  expense_title VARCHAR(255) NOT NULL,
  category_type VARCHAR(50) NOT NULL DEFAULT 'CUSTOM',
  custom_category_name VARCHAR(100),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(20) NOT NULL DEFAULT 'CASH',
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_by_role VARCHAR(20) NOT NULL DEFAULT 'OWNER',
  logged_by_user_id UUID REFERENCES auth.users(id),
  receipt_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============ 4. SAFE COLUMN ALTERATIONS ============
ALTER TABLE hostels 
  ADD COLUMN IF NOT EXISTS billing_day int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS voice_ai_provider text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS voice_ai_config jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS amenities jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS food_details text;

ALTER TABLE payments 
  ADD COLUMN IF NOT EXISTS payment_category TEXT DEFAULT 'tenant_rent',
  ADD COLUMN IF NOT EXISTS gateway_order_id TEXT;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS pause_ai_calls boolean DEFAULT false;

-- ============ 5. INDEXES (Idempotent) ============
CREATE INDEX IF NOT EXISTS idx_hostels_owner ON hostels(owner_id);
CREATE INDEX IF NOT EXISTS idx_profiles_hostel ON profiles(hostel_id);
CREATE INDEX IF NOT EXISTS idx_rooms_hostel ON rooms(hostel_id);
CREATE INDEX IF NOT EXISTS idx_rooms_floor ON rooms(floor_id);
CREATE INDEX IF NOT EXISTS idx_beds_room ON beds(room_id);
CREATE INDEX IF NOT EXISTS idx_beds_tenant ON beds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenants_hostel ON tenants(hostel_id);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_invoices_hostel ON invoices(hostel_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_category ON payments(payment_category);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_order_id ON payments(gateway_order_id);
CREATE INDEX IF NOT EXISTS idx_complaints_hostel ON complaints(hostel_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_room ON maintenance_tasks(room_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_tasks(status);
CREATE INDEX IF NOT EXISTS idx_ai_calls_hostel ON ai_call_logs(hostel_id);
CREATE INDEX IF NOT EXISTS idx_ai_calls_tenant ON ai_call_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_calls_status ON ai_call_logs(call_status);
CREATE INDEX IF NOT EXISTS idx_staff_hostel ON staff_members(hostel_id);
CREATE INDEX IF NOT EXISTS idx_rent_transactions_tenant ON rent_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rent_transactions_hostel ON rent_transactions(hostel_id);
CREATE INDEX IF NOT EXISTS idx_rent_transactions_status ON rent_transactions(status);
CREATE INDEX IF NOT EXISTS idx_rent_transactions_order ON rent_transactions(razorpay_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rent_transactions_active_invoice
  ON rent_transactions(invoice_id)
  WHERE invoice_id IS NOT NULL AND status IN ('PENDING', 'PAID');
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_gateway_order_id_unique
  ON payments(gateway_order_id)
  WHERE gateway_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_receipts_transaction ON payment_receipts(transaction_id);
CREATE INDEX IF NOT EXISTS idx_owner_payment_accounts_hostel ON owner_payment_accounts(hostel_id);
CREATE INDEX IF NOT EXISTS idx_expenses_hostel_id ON expenses (hostel_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses (category_type);
CREATE INDEX IF NOT EXISTS idx_expenses_method ON expenses (payment_method);

-- ============ 6. HELPER FUNCTIONS (SECURITY DEFINER) ============

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_user_hostel_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT hostel_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_hostel_staff(check_hostel_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_members WHERE hostel_id = check_hostel_id AND user_id = auth.uid() AND active = true
  ) OR EXISTS (
    SELECT 1 FROM hostels WHERE id = check_hostel_id AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION owns_hostel(check_hostel_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM hostels WHERE id = check_hostel_id AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

REVOKE ALL ON FUNCTION public.get_user_role() FROM anon;
REVOKE ALL ON FUNCTION public.get_user_hostel_id() FROM anon;
REVOKE ALL ON FUNCTION public.is_hostel_staff(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.owns_hostel(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_hostel_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_hostel_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_hostel(uuid) TO authenticated;

-- ============ 7. ROW LEVEL SECURITY (RLS) ============

ALTER TABLE hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- ============ 8. RLS POLICIES (All Preceded by DROP POLICY IF EXISTS) ============

-- HOSTELS
DROP POLICY IF EXISTS "hostels_select" ON hostels;
CREATE POLICY "hostels_select" ON hostels FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR get_user_role() = 'super_admin' OR is_hostel_staff(id));

DROP POLICY IF EXISTS "hostels_insert" ON hostels;
CREATE POLICY "hostels_insert" ON hostels FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "hostels_update" ON hostels;
CREATE POLICY "hostels_update" ON hostels FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR get_user_role() = 'super_admin')
  WITH CHECK (owner_id = auth.uid() OR get_user_role() = 'super_admin');

DROP POLICY IF EXISTS "hostels_delete" ON hostels;
CREATE POLICY "hostels_delete" ON hostels FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR get_user_role() = 'super_admin');

-- PROFILES
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR get_user_role() = 'super_admin' OR is_hostel_staff(hostel_id));

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
REVOKE INSERT ON profiles FROM anon, authenticated;

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR get_user_role() = 'super_admin')
  WITH CHECK (id = auth.uid() OR get_user_role() = 'super_admin');

-- FLOORS
DROP POLICY IF EXISTS "floors_select" ON floors;
CREATE POLICY "floors_select" ON floors FOR SELECT TO authenticated
  USING (is_hostel_staff(hostel_id));

DROP POLICY IF EXISTS "floors_insert" ON floors;
CREATE POLICY "floors_insert" ON floors FOR INSERT TO authenticated
  WITH CHECK (owns_hostel(hostel_id));

DROP POLICY IF EXISTS "floors_update" ON floors;
CREATE POLICY "floors_update" ON floors FOR UPDATE TO authenticated
  USING (owns_hostel(hostel_id)) WITH CHECK (owns_hostel(hostel_id));

DROP POLICY IF EXISTS "floors_delete" ON floors;
CREATE POLICY "floors_delete" ON floors FOR DELETE TO authenticated
  USING (owns_hostel(hostel_id));

-- ROOMS
DROP POLICY IF EXISTS "rooms_select" ON rooms;
CREATE POLICY "rooms_select" ON rooms FOR SELECT TO authenticated
  USING (is_hostel_staff(hostel_id));

DROP POLICY IF EXISTS "rooms_insert" ON rooms;
CREATE POLICY "rooms_insert" ON rooms FOR INSERT TO authenticated
  WITH CHECK (owns_hostel(hostel_id));

DROP POLICY IF EXISTS "rooms_update" ON rooms;
CREATE POLICY "rooms_update" ON rooms FOR UPDATE TO authenticated
  USING (is_hostel_staff(hostel_id)) WITH CHECK (is_hostel_staff(hostel_id));

DROP POLICY IF EXISTS "rooms_delete" ON rooms;
CREATE POLICY "rooms_delete" ON rooms FOR DELETE TO authenticated
  USING (owns_hostel(hostel_id));

-- BEDS
DROP POLICY IF EXISTS "beds_select" ON beds;
CREATE POLICY "beds_select" ON beds FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM rooms WHERE rooms.id = beds.room_id AND is_hostel_staff(rooms.hostel_id)));

DROP POLICY IF EXISTS "beds_insert" ON beds;
CREATE POLICY "beds_insert" ON beds FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM rooms WHERE rooms.id = beds.room_id AND owns_hostel(rooms.hostel_id)));

DROP POLICY IF EXISTS "beds_update" ON beds;
CREATE POLICY "beds_update" ON beds FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM rooms WHERE rooms.id = beds.room_id AND is_hostel_staff(rooms.hostel_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM rooms WHERE rooms.id = beds.room_id AND is_hostel_staff(rooms.hostel_id)));

DROP POLICY IF EXISTS "beds_delete" ON beds;
CREATE POLICY "beds_delete" ON beds FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM rooms WHERE rooms.id = beds.room_id AND owns_hostel(rooms.hostel_id)));

CREATE OR REPLACE FUNCTION public.update_room_inventory(
  p_room_id uuid,
  p_monthly_rent numeric,
  p_capacity integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_room public.rooms%ROWTYPE;
  v_bed_count integer;
  v_non_vacant_count integer;
  v_beds_to_remove integer;
  v_index integer;
  v_letter integer;
  v_label text;
  v_preferred_prefix text;
BEGIN
  IF p_monthly_rent IS NULL OR p_monthly_rent <= 0 THEN
    RAISE EXCEPTION 'Monthly rent must be greater than zero';
  END IF;

  IF p_capacity IS NULL OR p_capacity < 1 OR p_capacity > 10 THEN
    RAISE EXCEPTION 'Bed capacity must be between 1 and 10';
  END IF;

  SELECT *
  INTO v_room
  FROM public.rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found or access denied';
  END IF;

  PERFORM 1
  FROM public.beds
  WHERE room_id = p_room_id
  FOR UPDATE;

  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE status <> 'vacant' OR tenant_id IS NOT NULL)::integer
  INTO v_bed_count, v_non_vacant_count
  FROM public.beds
  WHERE room_id = p_room_id;

  IF v_non_vacant_count > p_capacity THEN
    RAISE EXCEPTION 'Capacity cannot be lower than the % occupied or maintenance bed(s)', v_non_vacant_count;
  END IF;

  UPDATE public.rooms
  SET monthly_rent = p_monthly_rent,
      capacity = p_capacity
  WHERE id = p_room_id;

  IF v_bed_count > p_capacity THEN
    v_beds_to_remove := v_bed_count - p_capacity;

    DELETE FROM public.beds
    WHERE id IN (
      SELECT id
      FROM public.beds
      WHERE room_id = p_room_id
        AND status = 'vacant'
        AND tenant_id IS NULL
      ORDER BY created_at DESC, id DESC
      LIMIT v_beds_to_remove
    );

    GET DIAGNOSTICS v_index = ROW_COUNT;
    IF v_index <> v_beds_to_remove THEN
      RAISE EXCEPTION 'Could not remove enough vacant beds to update capacity';
    END IF;
  ELSIF v_bed_count < p_capacity THEN
    IF EXISTS (
      SELECT 1
      FROM public.beds
      WHERE room_id = p_room_id
        AND bed_label LIKE 'Bed %'
    ) THEN
      v_preferred_prefix := 'Bed ';
    ELSE
      v_preferred_prefix := v_room.room_number || '-';
    END IF;

    FOR v_index IN 1..(p_capacity - v_bed_count) LOOP
      v_label := NULL;

      FOR v_letter IN 0..9 LOOP
        IF NOT EXISTS (
          SELECT 1 FROM public.beds
          WHERE room_id = p_room_id
            AND bed_label = v_preferred_prefix || chr(65 + v_letter)
        ) THEN
          v_label := v_preferred_prefix || chr(65 + v_letter);
          EXIT;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM public.beds
          WHERE room_id = p_room_id
            AND bed_label = 'Bed ' || chr(65 + v_letter)
        ) THEN
          v_label := 'Bed ' || chr(65 + v_letter);
          EXIT;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM public.beds
          WHERE room_id = p_room_id
            AND bed_label = v_room.room_number || '-' || chr(65 + v_letter)
        ) THEN
          v_label := v_room.room_number || '-' || chr(65 + v_letter);
          EXIT;
        END IF;
      END LOOP;

      IF v_label IS NULL THEN
        RAISE EXCEPTION 'Could not generate a unique label for the new bed';
      END IF;

      INSERT INTO public.beds (room_id, bed_label, status)
      VALUES (p_room_id, v_label, 'vacant');
    END LOOP;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_room_inventory(uuid, numeric, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_room_inventory(uuid, numeric, integer) TO authenticated;

-- TENANTS
DROP POLICY IF EXISTS "tenants_select" ON tenants;
CREATE POLICY "tenants_select" ON tenants FOR SELECT TO authenticated
  USING (is_hostel_staff(hostel_id) OR user_id = auth.uid());

DROP POLICY IF EXISTS "tenants_insert" ON tenants;
CREATE POLICY "tenants_insert" ON tenants FOR INSERT TO authenticated
  WITH CHECK (is_hostel_staff(hostel_id));

DROP POLICY IF EXISTS "tenants_update" ON tenants;
CREATE POLICY "tenants_update" ON tenants FOR UPDATE TO authenticated
  USING (is_hostel_staff(hostel_id)) WITH CHECK (is_hostel_staff(hostel_id));

DROP POLICY IF EXISTS "tenants_delete" ON tenants;
CREATE POLICY "tenants_delete" ON tenants FOR DELETE TO authenticated
  USING (owns_hostel(hostel_id));

-- INVOICES
DROP POLICY IF EXISTS "invoices_select" ON invoices;
CREATE POLICY "invoices_select" ON invoices FOR SELECT TO authenticated
  USING (is_hostel_staff(hostel_id) OR EXISTS (SELECT 1 FROM tenants WHERE tenants.id = invoices.tenant_id AND tenants.user_id = auth.uid()));

DROP POLICY IF EXISTS "invoices_insert" ON invoices;
CREATE POLICY "invoices_insert" ON invoices FOR INSERT TO authenticated
  WITH CHECK (is_hostel_staff(hostel_id));

DROP POLICY IF EXISTS "invoices_update" ON invoices;
CREATE POLICY "invoices_update" ON invoices FOR UPDATE TO authenticated
  USING (is_hostel_staff(hostel_id)) WITH CHECK (is_hostel_staff(hostel_id));

DROP POLICY IF EXISTS "invoices_delete" ON invoices;
CREATE POLICY "invoices_delete" ON invoices FOR DELETE TO authenticated
  USING (owns_hostel(hostel_id));

-- PAYMENTS
DROP POLICY IF EXISTS "payments_select" ON payments;
CREATE POLICY "payments_select" ON payments FOR SELECT TO authenticated
  USING (is_hostel_staff(hostel_id) OR EXISTS (SELECT 1 FROM tenants WHERE tenants.id = payments.tenant_id AND tenants.user_id = auth.uid()));

DROP POLICY IF EXISTS "payments_insert" ON payments;
CREATE POLICY "payments_insert" ON payments FOR INSERT TO authenticated
  WITH CHECK (is_hostel_staff(hostel_id));

DROP POLICY IF EXISTS "payments_update" ON payments;
CREATE POLICY "payments_update" ON payments FOR UPDATE TO authenticated
  USING (is_hostel_staff(hostel_id)) WITH CHECK (is_hostel_staff(hostel_id));

DROP POLICY IF EXISTS "payments_delete" ON payments;
CREATE POLICY "payments_delete" ON payments FOR DELETE TO authenticated
  USING (owns_hostel(hostel_id));

-- COMPLAINTS
DROP POLICY IF EXISTS "complaints_select" ON complaints;
CREATE POLICY "complaints_select" ON complaints FOR SELECT TO authenticated
  USING (is_hostel_staff(hostel_id) OR EXISTS (SELECT 1 FROM tenants WHERE tenants.id = complaints.tenant_id AND tenants.user_id = auth.uid()));

DROP POLICY IF EXISTS "complaints_insert" ON complaints;
CREATE POLICY "complaints_insert" ON complaints FOR INSERT TO authenticated
  WITH CHECK (is_hostel_staff(hostel_id) OR EXISTS (SELECT 1 FROM tenants WHERE tenants.id = complaints.tenant_id AND tenants.user_id = auth.uid()));

DROP POLICY IF EXISTS "complaints_update" ON complaints;
CREATE POLICY "complaints_update" ON complaints FOR UPDATE TO authenticated
  USING (is_hostel_staff(hostel_id)) WITH CHECK (is_hostel_staff(hostel_id));

DROP POLICY IF EXISTS "complaints_delete" ON complaints;
CREATE POLICY "complaints_delete" ON complaints FOR DELETE TO authenticated
  USING (owns_hostel(hostel_id));

-- MAINTENANCE
DROP POLICY IF EXISTS "maintenance_select" ON maintenance_tasks;
CREATE POLICY "maintenance_select" ON maintenance_tasks FOR SELECT TO authenticated
  USING (is_hostel_staff(hostel_id));

DROP POLICY IF EXISTS "maintenance_insert" ON maintenance_tasks;
CREATE POLICY "maintenance_insert" ON maintenance_tasks FOR INSERT TO authenticated
  WITH CHECK (is_hostel_staff(hostel_id));

DROP POLICY IF EXISTS "maintenance_update" ON maintenance_tasks;
CREATE POLICY "maintenance_update" ON maintenance_tasks FOR UPDATE TO authenticated
  USING (is_hostel_staff(hostel_id)) WITH CHECK (is_hostel_staff(hostel_id));

DROP POLICY IF EXISTS "maintenance_delete" ON maintenance_tasks;
CREATE POLICY "maintenance_delete" ON maintenance_tasks FOR DELETE TO authenticated
  USING (owns_hostel(hostel_id));

-- AI CALL LOGS
DROP POLICY IF EXISTS "ai_calls_select" ON ai_call_logs;
CREATE POLICY "ai_calls_select" ON ai_call_logs FOR SELECT TO authenticated
  USING (is_hostel_staff(hostel_id));

DROP POLICY IF EXISTS "ai_calls_insert" ON ai_call_logs;
CREATE POLICY "ai_calls_insert" ON ai_call_logs FOR INSERT TO authenticated
  WITH CHECK (owns_hostel(hostel_id));

DROP POLICY IF EXISTS "ai_calls_update" ON ai_call_logs;
CREATE POLICY "ai_calls_update" ON ai_call_logs FOR UPDATE TO authenticated
  USING (owns_hostel(hostel_id)) WITH CHECK (owns_hostel(hostel_id));

DROP POLICY IF EXISTS "ai_calls_delete" ON ai_call_logs;
CREATE POLICY "ai_calls_delete" ON ai_call_logs FOR DELETE TO authenticated
  USING (owns_hostel(hostel_id));

-- STAFF MEMBERS
DROP POLICY IF EXISTS "staff_select" ON staff_members;
CREATE POLICY "staff_select" ON staff_members FOR SELECT TO authenticated
  USING (owns_hostel(hostel_id) OR user_id = auth.uid() OR get_user_role() = 'super_admin');

DROP POLICY IF EXISTS "staff_insert" ON staff_members;
CREATE POLICY "staff_insert" ON staff_members FOR INSERT TO authenticated
  WITH CHECK (owns_hostel(hostel_id));

DROP POLICY IF EXISTS "staff_update" ON staff_members;
CREATE POLICY "staff_update" ON staff_members FOR UPDATE TO authenticated
  USING (owns_hostel(hostel_id)) WITH CHECK (owns_hostel(hostel_id));

DROP POLICY IF EXISTS "staff_delete" ON staff_members;
CREATE POLICY "staff_delete" ON staff_members FOR DELETE TO authenticated
  USING (owns_hostel(hostel_id));

-- OWNER PAYMENT ACCOUNTS
DROP POLICY IF EXISTS "owner_payment_accounts_owner_access" ON owner_payment_accounts;
DROP POLICY IF EXISTS "owner_payment_accounts_owner_select" ON owner_payment_accounts;
CREATE POLICY "owner_payment_accounts_owner_select" ON owner_payment_accounts
  FOR SELECT USING (
    hostel_id IN (SELECT id FROM hostels WHERE owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- OWNER SUBSCRIPTIONS
DROP POLICY IF EXISTS "owner_subscriptions_owner_access" ON owner_subscriptions;
CREATE POLICY "owner_subscriptions_owner_access" ON owner_subscriptions
  FOR ALL USING (
    hostel_owner_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- OWNER SUBSCRIPTION PAYMENT HISTORY
DROP POLICY IF EXISTS "owner_subscription_payments_owner_select" ON owner_subscription_payments;
CREATE POLICY "owner_subscription_payments_owner_select" ON owner_subscription_payments
  FOR SELECT TO authenticated USING (
    hostel_owner_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- RENT TRANSACTIONS
DROP POLICY IF EXISTS "rent_transactions_tenant_access" ON rent_transactions;
CREATE POLICY "rent_transactions_tenant_access" ON rent_transactions
  FOR SELECT USING (
    tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()) OR
    hostel_id IN (SELECT id FROM hostels WHERE owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS "rent_transactions_insert" ON rent_transactions;
CREATE POLICY "rent_transactions_insert" ON rent_transactions
  FOR INSERT WITH CHECK (
    hostel_id IN (SELECT id FROM hostels WHERE owner_id = auth.uid()) OR
    tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS "rent_transactions_service_update" ON rent_transactions;

-- PAYMENT RECEIPTS
DROP POLICY IF EXISTS "payment_receipts_access" ON payment_receipts;
CREATE POLICY "payment_receipts_access" ON payment_receipts
  FOR SELECT USING (
    transaction_id IN (
      SELECT id FROM rent_transactions WHERE
        tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()) OR
        hostel_id IN (SELECT id FROM hostels WHERE owner_id = auth.uid())
    ) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS "payment_receipts_service_insert" ON payment_receipts;

-- EXPENSES
DROP POLICY IF EXISTS "expenses_owner_all" ON expenses;
CREATE POLICY "expenses_owner_all" ON expenses
  FOR ALL
  USING (
    hostel_id IN (SELECT id FROM hostels WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    hostel_id IN (SELECT id FROM hostels WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "expenses_caretaker_select" ON expenses;
CREATE POLICY "expenses_caretaker_select" ON expenses
  FOR SELECT
  USING (
    hostel_id IN (SELECT hostel_id FROM profiles WHERE id = auth.uid() AND role = 'caretaker')
  );

DROP POLICY IF EXISTS "expenses_caretaker_insert" ON expenses;
CREATE POLICY "expenses_caretaker_insert" ON expenses
  FOR INSERT
  WITH CHECK (
    hostel_id IN (SELECT hostel_id FROM profiles WHERE id = auth.uid() AND role = 'caretaker')
  );

-- ============ 9. TRIGGERS & AUTOMATION ============

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
BEGIN
  v_role := CASE
    WHEN NEW.raw_user_meta_data->>'role' = 'caretaker' THEN 'caretaker'::user_role
    ELSE 'hostel_owner'::user_role
  END;

  INSERT INTO profiles (id, email, full_name, role, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), 'New User'),
    v_role,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'phone', ''), NEW.phone)
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        phone = COALESCE(profiles.phone, EXCLUDED.phone),
        full_name = CASE
          WHEN profiles.full_name = 'New User' THEN EXCLUDED.full_name
          ELSE profiles.full_name
        END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_hostels_updated ON hostels;
CREATE TRIGGER trigger_hostels_updated BEFORE UPDATE ON hostels FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_profiles_updated ON profiles;
CREATE TRIGGER trigger_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_rooms_updated ON rooms;
CREATE TRIGGER trigger_rooms_updated BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_tenants_updated ON tenants;
CREATE TRIGGER trigger_tenants_updated BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_invoices_updated ON invoices;
CREATE TRIGGER trigger_invoices_updated BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_ai_calls_updated ON ai_call_logs;
CREATE TRIGGER trigger_ai_calls_updated BEFORE UPDATE ON ai_call_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_expenses_updated_at ON expenses;
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============ 10. STORAGE BUCKETS & KYC OBJECT POLICIES ============

INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "kyc_upload" ON storage.objects;
CREATE POLICY "kyc_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "kyc_read_own" ON storage.objects;
CREATE POLICY "kyc_read_own" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "kyc_update_own" ON storage.objects;
CREATE POLICY "kyc_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "kyc_delete_own" ON storage.objects;
CREATE POLICY "kyc_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Hostels and inventory are created only after an owner submits the Add Hostel form.
