-- ============================================================
-- Razorpay Payment Engine Migration
-- Hostelhood Platform — Zero-Fee Rent Collection + AutoPay
-- ============================================================

-- 1. Owner Razorpay Linked Accounts
CREATE TABLE IF NOT EXISTS owner_payment_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hostel_owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    hostel_id UUID REFERENCES hostels(id) ON DELETE CASCADE,
    razorpay_account_id VARCHAR(255) UNIQUE NOT NULL,
    bank_account_number VARCHAR(50) NOT NULL,
    ifsc_code VARCHAR(15) NOT NULL,
    beneficiary_name VARCHAR(150) NOT NULL,
    verification_status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Owner SaaS Platform Subscriptions
CREATE TABLE IF NOT EXISTS owner_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hostel_owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    razorpay_subscription_id VARCHAR(255) UNIQUE NOT NULL,
    plan_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'CREATED', -- ACTIVE, HALTED, CANCELLED
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tenant Rent Ledger & Payment Transactions
CREATE TABLE IF NOT EXISTS rent_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, PAID, FAILED, REFUNDED
    is_autopay BOOLEAN DEFAULT FALSE,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, rent_month, rent_year)
);

-- 4. Generated Payment Receipts
CREATE TABLE IF NOT EXISTS payment_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number VARCHAR(100) UNIQUE NOT NULL, -- RCPT-2026-OCT-XXXX
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

-- RLS Policies
ALTER TABLE owner_payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;

-- Owners can manage their own payment accounts
CREATE POLICY "owner_payment_accounts_owner_access" ON owner_payment_accounts
    FOR ALL USING (
        hostel_owner_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    );

-- Owners can view their own subscriptions
CREATE POLICY "owner_subscriptions_owner_access" ON owner_subscriptions
    FOR ALL USING (
        hostel_owner_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    );

-- Tenants can view their own transactions; owners can view all for their hostel
CREATE POLICY "rent_transactions_tenant_access" ON rent_transactions
    FOR SELECT USING (
        tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()) OR
        hostel_id IN (SELECT id FROM hostels WHERE owner_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    );

CREATE POLICY "rent_transactions_insert" ON rent_transactions
    FOR INSERT WITH CHECK (
        hostel_id IN (SELECT id FROM hostels WHERE owner_id = auth.uid()) OR
        tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    );

-- Allow server (service role) to update transactions via webhook
CREATE POLICY "rent_transactions_service_update" ON rent_transactions
    FOR UPDATE USING (true);

-- Receipt access
CREATE POLICY "payment_receipts_access" ON payment_receipts
    FOR SELECT USING (
        transaction_id IN (
            SELECT id FROM rent_transactions WHERE
                tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()) OR
                hostel_id IN (SELECT id FROM hostels WHERE owner_id = auth.uid())
        ) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    );

CREATE POLICY "payment_receipts_service_insert" ON payment_receipts
    FOR INSERT WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rent_transactions_tenant ON rent_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rent_transactions_hostel ON rent_transactions(hostel_id);
CREATE INDEX IF NOT EXISTS idx_rent_transactions_status ON rent_transactions(status);
CREATE INDEX IF NOT EXISTS idx_rent_transactions_order ON rent_transactions(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_transaction ON payment_receipts(transaction_id);
CREATE INDEX IF NOT EXISTS idx_owner_payment_accounts_hostel ON owner_payment_accounts(hostel_id);
