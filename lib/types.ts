export type UserRole = 'super_admin' | 'hostel_owner' | 'caretaker' | 'tenant';
export type RoomStatus = 'vacant' | 'occupied' | 'maintenance';
export type BedStatus = 'vacant' | 'occupied' | 'maintenance';
export type RoomType = 'single' | 'double' | 'triple';
export type TenantStatus = 'active' | 'inactive' | 'on_leave';
export type InvoiceStatus = 'pending' | 'partial' | 'paid' | 'overdue';
export type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'razorpay' | 'stripe';
export type PaymentStatus = 'pending' | 'completed' | 'failed';
export type ComplaintStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type ComplaintPriority = 'low' | 'medium' | 'high';
export type MaintenanceTaskType = 'cleaning' | 'repair' | 'inspection';
export type MaintenanceStatus = 'pending' | 'in_progress' | 'completed';
export type AICallStatus = 'scheduled' | 'in_progress' | 'promised_to_pay' | 'call_failed' | 'escalated';
export type StaffRole = 'caretaker' | 'warden';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  hostel_id?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Hostel {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  total_floors: number;
  total_rooms: number;
  owner_id: string;
  billing_day: number;
  currency: string;
  amenities?: {
    hot_water?: boolean;
    wifi?: boolean;
    washing_machine?: boolean;
    fridge?: boolean;
    ac?: boolean;
    cctv?: boolean;
  };
  food_details?: string;
  voice_ai_provider: string;
  voice_ai_config: Record<string, unknown>;
  onboarding_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Floor {
  id: string;
  hostel_id: string;
  floor_number: number;
  name?: string;
}

export interface Room {
  id: string;
  hostel_id: string;
  floor_id?: string;
  room_number: string;
  room_type: RoomType;
  capacity: number;
  monthly_rent: number;
  status: RoomStatus;
  created_at: string;
  updated_at: string;
  beds?: Bed[];
  floor?: Floor;
}

export interface Bed {
  id: string;
  room_id: string;
  bed_label: string;
  status: BedStatus;
  tenant_id?: string;
  tenant?: Tenant;
  room?: Room;
}

export interface Tenant {
  id: string;
  hostel_id: string;
  user_id?: string;
  full_name: string;
  phone: string;
  email?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  id_proof_type: string;
  id_proof_url?: string;
  agreement_start?: string;
  agreement_end?: string;
  security_deposit: number;
  monthly_rent: number;
  rent_due_day: number;
  status: TenantStatus;
  assigned_bed_id?: string;
  pause_ai_calls: boolean;
  created_at: string;
  updated_at: string;
  assigned_bed?: Bed;
}

export interface Invoice {
  id: string;
  hostel_id: string;
  tenant_id: string;
  invoice_number: string;
  billing_month: number;
  billing_year: number;
  amount: number;
  amount_paid: number;
  due_date: string;
  status: InvoiceStatus;
  payment_link?: string;
  created_at: string;
  updated_at: string;
  tenant?: Tenant;
  payments?: Payment[];
}

export interface Payment {
  id: string;
  invoice_id: string;
  tenant_id: string;
  hostel_id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  recorded_by?: string;
  transaction_id?: string;
  notes?: string;
  created_at: string;
}

export interface Complaint {
  id: string;
  hostel_id: string;
  tenant_id: string;
  title: string;
  description?: string;
  category: string;
  status: ComplaintStatus;
  priority: ComplaintPriority;
  created_at: string;
  resolved_at?: string;
  tenant?: Tenant;
}

export interface MaintenanceTask {
  id: string;
  hostel_id: string;
  room_id: string;
  bed_id?: string;
  task_type: MaintenanceTaskType;
  status: MaintenanceStatus;
  assigned_to?: string;
  notes?: string;
  created_at: string;
  completed_at?: string;
  room?: Room;
}

export interface AICallLog {
  id: string;
  hostel_id: string;
  tenant_id: string;
  invoice_id?: string;
  call_status: AICallStatus;
  provider: string;
  provider_call_id?: string;
  tenant_name: string;
  amount_due: number;
  days_overdue: number;
  payment_link?: string;
  promised_pay_date?: string;
  call_duration_sec?: number;
  call_transcript?: string;
  created_at: string;
  updated_at: string;
  tenant?: Tenant;
}

export interface StaffMember {
  id: string;
  hostel_id: string;
  user_id: string;
  role: StaffRole;
  active: boolean;
  created_at: string;
}

export interface RoomWithDetails extends Room {
  beds: Bed[];
  floor?: Floor;
  tenant_count?: number;
}

export interface PlatformStats {
  totalHostels: number;
  totalRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  totalTenants: number;
  totalOwners: number;
  totalRevenue: number;
  pendingRevenue: number;
  totalInvoices: number;
  occupancyRate: number;
  activeComplaints: number;
  activeMaintenance: number;
  totalAiCalls: number;
}

export interface AdminHostelOverview extends Hostel {
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string;
  rooms_count?: number;
  beds_count?: number;
  occupied_beds_count?: number;
  active_tenants_count?: number;
  total_revenue?: number;
  pending_revenue?: number;
  occupancy_rate?: number;
}

// ─── Razorpay Payment Engine Types ───────────────────────────────────────────

export type RentTransactionStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
export type OwnerSubscriptionStatus = 'CREATED' | 'PROVISIONING' | 'TRIALING' | 'ACTIVE' | 'HALTED' | 'CANCELLED' | 'EXPIRED';

export interface OwnerPaymentAccount {
  id: string;
  hostel_owner_id: string;
  hostel_id: string;
  razorpay_account_id: string;
  verification_status: string;
  created_at: string;
}

export interface OwnerSubscription {
  id: string;
  hostel_owner_id: string;
  hostel_id?: string;
  onboarding_id?: string;
  razorpay_subscription_id?: string | null;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  billing_mode: 'AUTO_PAY' | 'ONE_TIME';
  plan_id: string;
  status: OwnerSubscriptionStatus;
  trial_starts_at?: string;
  trial_ends_at?: string;
  authorized_at?: string;
  razorpay_customer_id?: string;
  payment_method?: string;
  current_period_end?: string;
  created_at: string;
}

export interface RentTransaction {
  id: string;
  tenant_id: string;
  hostel_id: string;
  room_number: string;
  rent_month: string;
  rent_year: number;
  total_amount: number;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  payment_method?: string;
  bank_utr?: string;
  status: RentTransactionStatus;
  is_autopay: boolean;
  paid_at?: string;
  created_at: string;
}

export interface PaymentReceipt {
  id: string;
  receipt_number: string;
  transaction_id: string;
  hostel_name: string;
  hostel_address: string;
  hostel_phone: string;
  hostel_gstin?: string;
  tenant_name: string;
  tenant_phone: string;
  tenant_email?: string;
  room_number: string;
  rent_month: string;
  rent_year: number;
  amount_paid: number;
  payment_method: string;
  razorpay_payment_id: string;
  bank_utr?: string;
  pdf_url?: string;
  created_at: string;
}

export interface CreateRentOrderRequest {
  invoiceId: string;
}

// ─── Daily Expenses & Ledger Module Types ────────────────────────────────────

export type ExpenseCategoryType =
  | 'ELECTRICITY'
  | 'WATER'
  | 'MAINTENANCE'
  | 'GROCERIES'
  | 'SALARY'
  | 'FUEL'
  | 'INTERNET'
  | 'CUSTOM';

export type ExpensePaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'PETTY_CASH';

export type ExpenseLoggedByRole = 'OWNER' | 'CARETAKER';

export interface Expense {
  id: string;
  hostel_id: string;
  expense_title: string;
  category_type: ExpenseCategoryType;
  custom_category_name?: string;
  amount: number;
  payment_method: ExpensePaymentMethod;
  expense_date: string; // ISO date string YYYY-MM-DD
  logged_by_role: ExpenseLoggedByRole;
  logged_by_user_id?: string;
  receipt_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseLedgerStats {
  totalExpenses: number;
  cashTotal: number;
  upiTotal: number;
  bankTransferTotal: number;
  pettyCashTotal: number;
  countByCategory: Record<string, number>;
  amountByCategory: Record<string, number>;
}
