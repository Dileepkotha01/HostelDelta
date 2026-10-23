import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  User,
  Phone,
  Mail,
  ShieldCheck,
  DoorOpen,
  Calendar,
  IndianRupee,
  Receipt,
  CheckCircle2,
  Clock,
  Lock,
  Building2,
  FileText,
  CreditCard,
  AlertCircle,
} from 'lucide-react';
import type { Metadata } from 'next';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { buildInvoicePayUrl, verifySignedAccessToken } from '@/lib/signed-access';

export const metadata: Metadata = {
  title: 'Resident Profile & Rent History | Kupera',
  description: 'View your verified hostel resident details, room allocation, and monthly rent payment history.',
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface PageProps {
  params: {
    tenantId: string;
  };
  searchParams: {
    t?: string;
  };
}

export default async function TenantViewPage({ params, searchParams }: PageProps) {
  const { tenantId } = params;
  if (!UUID_RE.test(tenantId)) {
    return notFound();
  }

  const access = verifySignedAccessToken(searchParams.t, 'tenant_view', tenantId);
  if (!access.ok) {
    return notFound();
  }

  const supabase = createSupabaseAdmin();

  // 1. Fetch tenant details (service role only after signed-link verification)
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  if (tenantErr || !tenant) {
    return notFound();
  }

  // 1.1 Fetch bed & room details cleanly
  let bedInfo: any = null;
  let roomInfo: any = null;
  if (tenant.assigned_bed_id) {
    const { data: bed } = await supabase
      .from('beds')
      .select('*, room:rooms(*)')
      .eq('id', tenant.assigned_bed_id)
      .single();
    if (bed) {
      bedInfo = bed;
      roomInfo = bed.room;
    }
  }

  // 2. Fetch hostel details
  const { data: hostel } = await supabase
    .from('hostels')
    .select('*')
    .eq('id', tenant.hostel_id)
    .single();

  // 3. Fetch all invoices for rent payment records
  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false });

  // 4. Fetch rent transactions & receipts
  const { data: transactions } = await supabase
    .from('rent_transactions')
    .select('*, receipt:payment_receipts(*)')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false });

  const invoicePayUrls = new Map<string, string>();
  for (const inv of invoices || []) {
    if (inv.status !== 'paid') {
      try {
        invoicePayUrls.set(inv.id, buildInvoicePayUrl(inv.id));
      } catch {
        // Signed links may be unavailable in misconfigured environments.
      }
    }
  }

  const roomLabel = roomInfo?.room_number
    ? `Room #${roomInfo.room_number}`
    : 'Assigned Room';

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8 selection:bg-indigo-500 selection:text-white">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Top Header / Branding */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-black bg-gradient-to-r from-indigo-400 via-purple-300 to-indigo-200 bg-clip-text text-transparent">
                Kupera
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                Resident Portal
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              {tenant.full_name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 flex items-center gap-1.5 mt-0.5">
              <Building2 className="w-4 h-4 text-indigo-400" />
              <span>{hostel?.name || 'Kupera Hostel'}</span>
              <span>•</span>
              <span>{roomLabel} {bedInfo?.bed_label ? `(Bed ${bedInfo.bed_label})` : ''}</span>
            </p>
          </div>

          {/* Read-Only Notice Badge */}
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <p className="font-semibold text-white">Verified Record</p>
              <p className="text-[11px] text-slate-400">Read-only • Managed by Hostel Admin</p>
            </div>
          </div>
        </div>

        {/* Info Grid: Profile & Rent Agreement */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Resident Details */}
          <Card className="bg-slate-900/90 border-slate-800 backdrop-blur-md">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-400" />
                <CardTitle className="text-base text-white">Resident Details</CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-400">Personal & verified identity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <p className="text-[11px] text-slate-400">Full Name</p>
                <p className="font-semibold text-white mt-0.5">{tenant.full_name}</p>
              </div>

              <div>
                <p className="text-[11px] text-slate-400">Primary Phone</p>
                <p className="font-semibold text-white mt-0.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {tenant.phone}
                </p>
              </div>

              {tenant.email && (
                <div>
                  <p className="text-[11px] text-slate-400">Email Address</p>
                  <p className="font-semibold text-white mt-0.5 flex items-center gap-1.5 break-all">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {tenant.email}
                  </p>
                </div>
              )}

              {tenant.emergency_contact_name && (
                <div className="pt-2 border-t border-slate-800/80">
                  <p className="text-[11px] text-slate-400">Emergency Contact</p>
                  <p className="font-semibold text-slate-200 mt-0.5">
                    {tenant.emergency_contact_name} ({tenant.emergency_contact_phone || '—'})
                  </p>
                </div>
              )}

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-slate-400">ID Verification</p>
                  <p className="font-semibold text-slate-200 uppercase text-xs mt-0.5">
                    {tenant.id_proof_type || 'Aadhaar'}
                  </p>
                </div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Verified
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Room & Allocation */}
          <Card className="bg-slate-900/90 border-slate-800 backdrop-blur-md">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <DoorOpen className="w-4 h-4 text-purple-400" />
                <CardTitle className="text-base text-white">Room & Allocation</CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-400">Current living assignment</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <p className="text-[11px] text-slate-400">Hostel Branch</p>
                <p className="font-semibold text-white mt-0.5">{hostel?.name || 'Kupera Hostel'}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{hostel?.address || 'Hostel Campus'}</p>
              </div>

              <div className="pt-2 border-t border-slate-800/80">
                <p className="text-[11px] text-slate-400">Assigned Room</p>
                <p className="font-semibold text-white mt-0.5 text-base text-purple-300">
                  {roomLabel}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Type: {roomInfo?.room_type || 'Standard'} • Bed: {bedInfo?.bed_label || 'Allocated'}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800/80">
                <p className="text-[11px] text-slate-400">Occupancy Status</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-semibold text-emerald-400 capitalize">{tenant.status} Resident</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Rent & Billing Agreement */}
          <Card className="bg-slate-900/90 border-slate-800 backdrop-blur-md">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-emerald-400" />
                <CardTitle className="text-base text-white">Rent & Agreement</CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-400">Monthly schedule & advance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs sm:text-sm">
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <p className="text-[11px] text-slate-400 font-medium">Monthly Rent Amount</p>
                <p className="text-2xl font-black text-emerald-400 mt-0.5">
                  ₹{Number(tenant.monthly_rent || 0).toLocaleString('en-IN')}
                </p>
                <p className="text-[11px] text-amber-300/90 mt-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Due on Day <strong>{tenant.rent_due_day || 1}</strong> of every month
                </p>
              </div>

              <div>
                <p className="text-[11px] text-slate-400">Advance / Security Deposit</p>
                <p className="font-semibold text-white mt-0.5">
                  ₹{Number(tenant.security_deposit || 0).toLocaleString('en-IN')}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800/80">
                <p className="text-[11px] text-slate-400">Agreement Timeline</p>
                <p className="font-semibold text-slate-200 mt-0.5 text-xs">
                  {tenant.agreement_start ? new Date(tenant.agreement_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Joining date'}
                  {' → '}
                  {tenant.agreement_end ? new Date(tenant.agreement_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Ongoing / Monthly'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section: Monthly Rent Payment History */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-400" />
                Monthly Rent Payment History
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Track all monthly rent invoices, advance payments, and completed transaction receipts.
              </p>
            </div>
          </div>

          <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            {(!invoices || invoices.length === 0) && (!transactions || transactions.length === 0) ? (
              <CardContent className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-800 mx-auto flex items-center justify-center text-slate-500">
                  <Clock className="w-6 h-6" />
                </div>
                <h3 className="font-medium text-slate-300">No Invoices Recorded Yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Your monthly rent invoices will automatically appear here once scheduled by your hostel management.
                </p>
              </CardContent>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-4 font-semibold">Invoice / Bill</th>
                      <th className="py-3 px-4 font-semibold">Period</th>
                      <th className="py-3 px-4 font-semibold">Due Date</th>
                      <th className="py-3 px-4 font-semibold">Amount</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Receipt / Pay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {invoices?.map((inv) => {
                      const isPaid = inv.status === 'paid';
                      const isPending = inv.status === 'pending';
                      const isOverdue = inv.status === 'overdue';
                      const periodName = inv.billing_month ? `${monthNames[inv.billing_month - 1]} ${inv.billing_year}` : 'Initial Advance';

                      // Find matching receipt from transactions if exists
                      const matchingTx = transactions?.find(
                        (t) => (t.rent_month === monthNames[inv.billing_month - 1] && t.rent_year === inv.billing_year) || t.status === 'PAID'
                      );
                      const receiptPdf = matchingTx?.receipt?.[0]?.pdf_url;

                      return (
                        <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-medium text-slate-200">
                            {inv.invoice_number}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-white">
                            {periodName}
                          </td>
                          <td className="py-3.5 px-4 text-slate-400">
                            {inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-white">
                            ₹{Number(inv.amount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3.5 px-4">
                            {isPaid ? (
                              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] uppercase">
                                Paid
                              </Badge>
                            ) : isOverdue ? (
                              <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px] uppercase">
                                Overdue
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] uppercase">
                                Pending
                              </Badge>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {isPaid && receiptPdf ? (
                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs border-slate-700 bg-slate-800 text-slate-200 hover:text-white"
                              >
                                <a href={receiptPdf} target="_blank" rel="noopener noreferrer">
                                  <FileText className="w-3.5 h-3.5 mr-1 text-indigo-400" /> Receipt
                                </a>
                              </Button>
                            ) : isPaid ? (
                              <span className="text-xs text-emerald-400 font-semibold flex items-center justify-end gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                              </span>
                            ) : invoicePayUrls.get(inv.id) ? (
                              <Button
                                asChild
                                size="sm"
                                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                              >
                                <a href={invoicePayUrls.get(inv.id)}>
                                  Pay Now →
                                </a>
                              </Button>
                            ) : (
                              <span className="text-xs text-amber-300">Ask your manager for a pay link</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Footer info */}
        <div className="pt-6 pb-12 border-t border-slate-800 text-center text-xs text-slate-500 space-y-1">
          <p>
            🔒 This is your verified resident summary at <strong>{hostel?.name || 'Kupera Hostel'}</strong>.
          </p>
          <p>
            Resident records cannot be edited directly by tenants to prevent unauthorized tampering. Need to update contact details or room? Please notify your hostel manager.
          </p>
        </div>

      </div>
    </div>
  );
}
