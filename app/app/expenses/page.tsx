'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useHostelScope } from '@/hooks/use-hostel-scope';
import { NoHostelLinked } from '@/components/no-hostel-linked';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import type {
  Expense,
  ExpenseCategoryType,
  ExpensePaymentMethod,
} from '@/lib/types';
import {
  TrendingDown,
  Plus,
  Download,
  Search,
  Zap,
  Droplets,
  Wrench,
  ShoppingCart,
  Users2,
  Fuel,
  Wifi,
  Tag,
  Banknote,
  Smartphone,
  Building2,
  Wallet,
  CalendarDays,
  Trash2,
  Loader2,
  IndianRupee,
  TrendingUp,
  Scale,
  Receipt,
  FileText,
  X,
  ImageIcon,
} from 'lucide-react';

// ─── Category Config ──────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<
  ExpenseCategoryType,
  { label: string; icon: React.ElementType; color: string; bg: string; border: string }
> = {
  ELECTRICITY: { label: 'Electricity', icon: Zap,         color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-400/30' },
  WATER:       { label: 'Water',       icon: Droplets,    color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-500/10',   border: 'border-blue-400/30'   },
  MAINTENANCE: { label: 'Maintenance', icon: Wrench,      color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-400/30' },
  GROCERIES:   { label: 'Groceries',   icon: ShoppingCart,color: 'text-green-600 dark:text-green-400',   bg: 'bg-green-500/10',  border: 'border-green-400/30'  },
  SALARY:      { label: 'Salary',      icon: Users2,      color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-400/30' },
  FUEL:        { label: 'Fuel',        icon: Fuel,        color: 'text-red-600 dark:text-red-400',       bg: 'bg-red-500/10',    border: 'border-red-400/30'    },
  INTERNET:    { label: 'Internet',    icon: Wifi,        color: 'text-cyan-600 dark:text-cyan-400',     bg: 'bg-cyan-500/10',   border: 'border-cyan-400/30'   },
  CUSTOM:      { label: 'Custom',      icon: Tag,         color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-400/30' },
};

const METHOD_CONFIG: Record<
  ExpensePaymentMethod,
  { label: string; icon: React.ElementType; color: string }
> = {
  CASH:          { label: 'Cash',          icon: Banknote,   color: 'text-emerald-600 dark:text-emerald-400' },
  UPI:           { label: 'UPI',           icon: Smartphone, color: 'text-blue-600 dark:text-blue-400'       },
  BANK_TRANSFER: { label: 'Bank Transfer', icon: Building2,  color: 'text-violet-600 dark:text-violet-400'   },
  PETTY_CASH:    { label: 'Petty Cash',    icon: Wallet,     color: 'text-amber-600 dark:text-amber-400'     },
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  if (d.getTime() === today.getTime()) return 'Today';
  if (d.getTime() === yest.getTime())  return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function groupByDate(list: Expense[]) {
  const map = new Map<string, Expense[]>();
  list.forEach((e) => {
    if (!map.has(e.expense_date)) map.set(e.expense_date, []);
    map.get(e.expense_date)!.push(e);
  });
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
}

interface FormState {
  expense_title: string;
  category_type: ExpenseCategoryType;
  custom_category_name: string;
  amount: string;
  payment_method: ExpensePaymentMethod;
  expense_date: string;
  notes: string;
  receipt_url: string;
}

function makeInitForm(): FormState {
  return {
    expense_title: '',
    category_type: 'CUSTOM',
    custom_category_name: '',
    amount: '',
    payment_method: 'CASH',
    expense_date: todayISO(),
    notes: '',
    receipt_url: '',
  };
}
const INIT_FORM = makeInitForm();

export default function ExpensesPage() {
  const { profile, hostelId, isReady, hasHostel } = useHostelScope();
  const { toast } = useToast();

  const [expenses, setExpenses]   = useState<Expense[]>([]);
  const [loading, setLoading]     = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);

  // Filters
  const [search, setSearch]             = useState('');
  const [catFilter, setCatFilter]       = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [dateRange, setDateRange]       = useState<'today'|'week'|'month'|'all'>('month');

  // Add modal
  const [addOpen, setAddOpen]     = useState(false);
  const [form, setForm]           = useState<FormState>(makeInitForm);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [deleting, setDeleting]     = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isReady) return;
    if (!hostelId) { setLoading(false); return; }
    loadAll(hostelId);
  }, [isReady, hostelId]);

  async function loadAll(hid: string) {
    setLoading(true);
    const [expRes, payRes] = await Promise.all([
      supabase
        .from('expenses')
        .select('*')
        .eq('hostel_id', hid)
        .order('expense_date', { ascending: false })
        .order('created_at',   { ascending: false }),
      supabase
        .from('payments')
        .select('amount')
        .eq('hostel_id', hid)
        .eq('status', 'completed'),
    ]);
    setExpenses((expRes.data || []) as Expense[]);
    const rev = ((payRes.data || []) as { amount: number }[])
      .reduce((s, p) => s + Number(p.amount), 0);
    setTotalRevenue(rev);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return expenses.filter((e) => {
      if (dateRange !== 'all') {
        const d = new Date(e.expense_date + 'T00:00:00');
        if (dateRange === 'today') {
          if (d.getTime() !== today.getTime()) return false;
        } else if (dateRange === 'week') {
          const ago = new Date(today); ago.setDate(ago.getDate() - 7);
          if (d < ago) return false;
        } else {
          const ago = new Date(today); ago.setDate(ago.getDate() - 30);
          if (d < ago) return false;
        }
      }
      if (catFilter !== 'all' && e.category_type !== catFilter) return false;
      if (methodFilter !== 'all' && e.payment_method !== methodFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!e.expense_title.toLowerCase().includes(q) &&
            !(e.custom_category_name || '').toLowerCase().includes(q) &&
            !(e.notes || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [expenses, dateRange, catFilter, methodFilter, search]);

  const stats = useMemo(() => {
    const total   = filtered.reduce((s, e) => s + Number(e.amount), 0);
    const cash    = filtered.filter(e => e.payment_method === 'CASH').reduce((s, e) => s + Number(e.amount), 0);
    const upi     = filtered.filter(e => e.payment_method === 'UPI').reduce((s, e) => s + Number(e.amount), 0);
    const petty   = filtered.filter(e => e.payment_method === 'PETTY_CASH').reduce((s, e) => s + Number(e.amount), 0);
    const bank    = filtered.filter(e => e.payment_method === 'BANK_TRANSFER').reduce((s, e) => s + Number(e.amount), 0);
    return { total, cash, upi, petty, bank, net: totalRevenue - total };
  }, [filtered, totalRevenue]);

  async function handleReceiptUpload(file: File) {
    if (!profile?.id) return;
    setUploading(true);
    const ext  = file.name.split('.').pop();
    const path = `${profile.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('expense-receipts').upload(path, file, { upsert: true });
    if (error) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from('expense-receipts').getPublicUrl(path);
    setForm(f => ({ ...f, receipt_url: data.publicUrl }));
    setUploading(false);
    toast({ title: 'Receipt uploaded ✅' });
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!hostelId || !profile || !form.expense_title.trim() || !form.amount) return;
    setSubmitting(true);
    const { error } = await supabase.from('expenses').insert({
      hostel_id:            hostelId,
      expense_title:        form.expense_title.trim(),
      category_type:        form.category_type,
      custom_category_name: form.category_type === 'CUSTOM' ? (form.custom_category_name.trim() || null) : null,
      amount:               parseFloat(form.amount),
      payment_method:       form.payment_method,
      expense_date:         form.expense_date,
      logged_by_role:       profile.role === 'caretaker' ? 'CARETAKER' : 'OWNER',
      logged_by_user_id:    profile.id,
      receipt_url:          form.receipt_url || null,
      notes:                form.notes.trim() || null,
    });
    if (error) {
      toast({ title: 'Failed to log expense', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Expense logged ✅', description: `₹${parseFloat(form.amount).toLocaleString('en-IN')} — ${form.expense_title}` });
      setAddOpen(false);
      setForm(makeInitForm());
      loadAll(hostelId);
    }
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    if (!hostelId) return;
    setDeleting(id);
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    } else {
      setExpenses(prev => prev.filter(e => e.id !== id));
      toast({ title: 'Expense deleted' });
    }
    setDeleting(null);
  }

  function exportCSV() {
    const headers = ['Date','Title','Category','Amount (Rs)','Method','Role','Notes'];
    const rows = filtered.map(e => [
      e.expense_date,
      e.expense_title,
      e.category_type === 'CUSTOM' ? (e.custom_category_name || 'Custom') : CATEGORY_CONFIG[e.category_type].label,
      e.amount,
      e.payment_method.replace('_',' '),
      e.logged_by_role,
      e.notes || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a   = document.createElement('a');
    a.href     = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4 text-muted-foreground animate-pulse">
        <TrendingDown className="w-8 h-8 opacity-50" />
        <p>Loading ledger...</p>
      </div>
    </div>
  );

  if (isReady && !hasHostel) return <NoHostelLinked />;

  const groups = groupByDate(filtered);

  return (
    <div className="space-y-8 pb-8">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-lg shadow-rose-500/30 shrink-0">
              <TrendingDown className="w-5 h-5 text-white" />
            </span>
            Expense Ledger
          </h1>
          <p className="text-muted-foreground mt-2 font-medium">
            Log daily operational costs and track your hostel&apos;s financial balance sheet.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={exportCSV} variant="outline" className="shadow-sm gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          <Button onClick={() => setAddOpen(true)} className="shadow-lg shadow-primary/25 gap-2">
            <Plus className="w-4 h-4" /> Log Expense
          </Button>
        </div>
      </div>

      {/* ── Financial Balance KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {[
          {
            label: 'Total Revenue', value: `₹${totalRevenue.toLocaleString('en-IN')}`, sub: 'Collected rent & payments',
            Icon: TrendingUp, bg: 'from-emerald-500/20 to-emerald-400/5 border-emerald-400/40', ic: 'text-emerald-600 dark:text-emerald-400',
          },
          {
            label: 'Total Expenses', value: `₹${stats.total.toLocaleString('en-IN')}`, sub: `${filtered.length} entries logged`,
            Icon: TrendingDown, bg: 'from-rose-500/20 to-rose-400/5 border-rose-400/40', ic: 'text-rose-600 dark:text-rose-400',
          },
          {
            label: 'Net Profit / Loss',
            value: `${stats.net >= 0 ? '+' : ''}₹${Math.abs(stats.net).toLocaleString('en-IN')}`,
            sub: 'Revenue − Expenses',
            Icon: Scale,
            bg: stats.net >= 0 ? 'from-blue-500/20 to-blue-400/5 border-blue-400/40' : 'from-red-500/20 to-red-400/5 border-red-400/40',
            ic: stats.net >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400',
          },
          {
            label: 'Cash Outflows', value: `₹${(stats.cash + stats.petty).toLocaleString('en-IN')}`, sub: 'Cash + Petty Cash',
            Icon: Wallet, bg: 'from-amber-500/20 to-amber-400/5 border-amber-400/40', ic: 'text-amber-600 dark:text-amber-400',
          },
        ].map(({ label, value, sub, Icon, bg, ic }) => (
          <div key={label} className={`relative overflow-hidden rounded-xl border bg-gradient-to-br p-3.5 sm:p-4 flex flex-col justify-between hover:scale-[1.02] hover:shadow-md transition-all ${bg}`}>
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="text-[11px] sm:text-xs font-semibold opacity-85 truncate">{label}</span>
              <div className="p-1.5 rounded-lg bg-background/50 shadow-sm shrink-0">
                <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${ic}`} />
              </div>
            </div>
            <div>
              <p className={`text-xl sm:text-2xl lg:text-3xl font-black tracking-tight truncate ${ic}`}>{value}</p>
              <p className="text-[10px] sm:text-xs opacity-70 mt-0.5 truncate">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Payment Method Breakdown ── */}
      <div className="bg-card border rounded-2xl p-4 sm:p-5 shadow-sm">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <IndianRupee className="w-3.5 h-3.5" /> Payment Method Breakdown
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Cash',          value: stats.cash,  Icon: Banknote,   color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
            { label: 'UPI',           value: stats.upi,   Icon: Smartphone, color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-500/10'   },
            { label: 'Bank Transfer', value: stats.bank,  Icon: Building2,  color: 'text-violet-600 dark:text-violet-400',   bg: 'bg-violet-500/10' },
            { label: 'Petty Cash',    value: stats.petty, Icon: Wallet,     color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-500/10'  },
          ].map(({ label, value, Icon, color, bg }) => {
            const pct = stats.total > 0 ? Math.round((value / stats.total) * 100) : 0;
            return (
              <div key={label} className={`flex items-center gap-3 rounded-xl p-3 ${bg}`}>
                <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center shadow-sm shrink-0">
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
                  <p className="font-black text-sm truncate">₹{value.toLocaleString('en-IN')}</p>
                  <p className="text-[10px] text-muted-foreground">{pct}% of total</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-card border rounded-2xl p-2 shadow-sm space-y-2">
        <div className="flex flex-col sm:flex-row gap-2 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search expenses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 border-none bg-transparent focus-visible:ring-0 shadow-none"
            />
          </div>
          <div className="h-px sm:h-8 w-full sm:w-px bg-border" />
          <Tabs value={dateRange} onValueChange={(v) => setDateRange(v as typeof dateRange)} className="w-full sm:w-auto">
            <TabsList className="h-10 bg-transparent border-none p-0 space-x-1 w-full sm:w-auto justify-start overflow-x-auto no-scrollbar">
              <TabsTrigger value="today"  className="data-[state=active]:bg-secondary rounded-xl text-xs">Today</TabsTrigger>
              <TabsTrigger value="week"   className="data-[state=active]:bg-secondary rounded-xl text-xs">7 Days</TabsTrigger>
              <TabsTrigger value="month"  className="data-[state=active]:bg-secondary rounded-xl text-xs">30 Days</TabsTrigger>
              <TabsTrigger value="all"    className="data-[state=active]:bg-secondary rounded-xl text-xs">All Time</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex flex-wrap gap-2 px-1 pb-1">
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="h-8 text-xs w-auto min-w-[130px] bg-secondary/40 border-none">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {(Object.keys(CATEGORY_CONFIG) as ExpenseCategoryType[]).map((k) => (
                <SelectItem key={k} value={k}>{CATEGORY_CONFIG[k].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="h-8 text-xs w-auto min-w-[130px] bg-secondary/40 border-none">
              <SelectValue placeholder="All Methods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              {(Object.keys(METHOD_CONFIG) as ExpensePaymentMethod[]).map((k) => (
                <SelectItem key={k} value={k}>{METHOD_CONFIG[k].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(search || catFilter !== 'all' || methodFilter !== 'all') && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground gap-1"
              onClick={() => { setSearch(''); setCatFilter('all'); setMethodFilter('all'); }}>
              <X className="w-3 h-3" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* ── Expense List ── */}
      {filtered.length === 0 ? (
        <div className="border-2 border-dashed rounded-3xl flex flex-col items-center justify-center py-20 text-center gap-4 bg-card/50">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
            <Receipt className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-xl font-bold">No Expenses Found</h3>
            <p className="text-muted-foreground mt-1 max-w-sm mx-auto text-sm">
              {expenses.length === 0
                ? 'Start by tapping "Log Expense" to record your first operational cost.'
                : 'No expenses match your current filters.'}
            </p>
          </div>
          <Button onClick={() => setAddOpen(true)} className="gap-2 shadow-lg shadow-primary/20">
            <Plus className="w-4 h-4" /> Log First Expense
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ date, items }) => {
            const dayTotal = items.reduce((s, e) => s + Number(e.amount), 0);
            return (
              <div key={date}>
                <div className="flex items-center gap-3 mb-3">
                  <CalendarDays className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm font-bold">{formatDateLabel(date)}</span>
                  <span className="text-xs text-muted-foreground font-mono">({date})</span>
                  <div className="flex-1 h-px bg-border" />
                  <Badge variant="secondary" className="font-bold text-xs shrink-0">
                    ₹{dayTotal.toLocaleString('en-IN')}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {items.map((exp) => {
                    const cat  = CATEGORY_CONFIG[exp.category_type];
                    const meth = METHOD_CONFIG[exp.payment_method];
                    const CatIcon  = cat.icon  as React.ElementType;
                    const MethIcon = meth.icon as React.ElementType;
                    const displayCat = exp.category_type === 'CUSTOM'
                      ? (exp.custom_category_name || 'Custom') : cat.label;
                    return (
                      <div key={exp.id}
                        className={`group relative p-4 rounded-2xl border bg-card hover:shadow-lg transition-all duration-200 flex flex-col gap-3 ${cat.border}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${cat.bg} ${cat.border}`}>
                            <CatIcon className={`w-5 h-5 ${cat.color}`} />
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            <Badge variant="outline" className={`text-[10px] px-2 py-0 ${cat.bg} ${cat.color} border ${cat.border}`}>
                              {displayCat}
                            </Badge>
                            <Badge variant="outline" className={`text-[10px] px-2 py-0 ${meth.color}`}>
                              <MethIcon className="w-2.5 h-2.5 mr-0.5" />
                              {meth.label}
                            </Badge>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-bold text-sm leading-tight line-clamp-2">{exp.expense_title}</h4>
                          {exp.notes && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{exp.notes}</p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border/60 mt-auto">
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            exp.logged_by_role === 'CARETAKER'
                              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          }`}>
                            {exp.logged_by_role === 'CARETAKER' ? 'Caretaker' : 'Owner'}
                          </span>
                          <div className="flex items-center gap-2">
                            {exp.receipt_url && (
                              <a href={exp.receipt_url} target="_blank" rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-primary transition-colors" title="View Receipt">
                                <ImageIcon className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <span className="font-black text-base">₹{Number(exp.amount).toLocaleString('en-IN')}</span>
                          </div>
                        </div>

                        {profile?.role !== 'caretaker' && (
                          <button
                            onClick={() => handleDelete(exp.id)}
                            disabled={deleting === exp.id}
                            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-destructive/10 text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-destructive hover:text-white"
                          >
                            {deleting === exp.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <Trash2 className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add Expense Modal ── */}
      <Dialog open={addOpen} onOpenChange={(o) => { if (!o) { setAddOpen(false); setForm(INIT_FORM); } }}>
        <DialogContent className="w-[calc(100vw-24px)] sm:w-full max-w-md max-h-[92vh] flex flex-col p-0 overflow-hidden bg-card border-border rounded-2xl sm:rounded-3xl shadow-2xl">
          <div className="bg-gradient-to-r from-rose-500/15 via-orange-500/10 to-transparent p-4 sm:p-6 pb-3 sm:pb-4 border-b shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-md shrink-0">
                  <Plus className="w-4 h-4 text-white" />
                </div>
                Log Expense
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm mt-1">
                Record an operational cost for your hostel&apos;s financial ledger.
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleAdd} className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 overflow-y-auto flex-1 no-scrollbar">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="exp-title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Expense Description *
              </Label>
              <Input id="exp-title" placeholder='"Plumber repair Room 204", "Electricity Bill Oct"'
                value={form.expense_title}
                onChange={(e) => setForm(f => ({ ...f, expense_title: e.target.value }))}
                required className="bg-secondary/30" />
            </div>

            {/* Category */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category *</Label>
                <Select value={form.category_type} onValueChange={(v) => setForm(f => ({ ...f, category_type: v as ExpenseCategoryType }))}>
                  <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CATEGORY_CONFIG) as ExpenseCategoryType[]).map(k => (
                      <SelectItem key={k} value={k}>{CATEGORY_CONFIG[k].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.category_type === 'CUSTOM' && (
                <div className="space-y-1.5">
                  <Label htmlFor="exp-ccat" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Custom Name</Label>
                  <Input id="exp-ccat" placeholder="e.g. Generator Fuel"
                    value={form.custom_category_name}
                    onChange={(e) => setForm(f => ({ ...f, custom_category_name: e.target.value }))}
                    className="bg-secondary/30" />
                </div>
              )}
            </div>

            {/* Amount + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="exp-amount" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount (₹) *</Label>
                <Input id="exp-amount" type="number" min="1" step="0.01" placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                  required className="bg-secondary/30 font-bold" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exp-date" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date *</Label>
                <Input id="exp-date" type="date"
                  value={form.expense_date}
                  onChange={(e) => setForm(f => ({ ...f, expense_date: e.target.value }))}
                  required className="bg-secondary/30" />
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment Method *</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(METHOD_CONFIG) as ExpensePaymentMethod[]).map(key => {
                  const cfg = METHOD_CONFIG[key];
                  const Icon = cfg.icon as React.ElementType;
                  const active = form.payment_method === key;
                  return (
                    <button key={key} type="button"
                      onClick={() => setForm(f => ({ ...f, payment_method: key }))}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        active
                          ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                          : 'bg-secondary/30 border-border hover:border-primary/50 hover:bg-secondary'
                      }`}>
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate text-xs">{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="exp-notes" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <FileText className="w-3 h-3" /> Notes (Optional)
              </Label>
              <Input id="exp-notes" placeholder="Vendor name, bill ref, etc."
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                className="bg-secondary/30" />
            </div>

            {/* Receipt */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <ImageIcon className="w-3 h-3" /> Receipt Photo (Optional)
              </Label>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReceiptUpload(f); }} />
              {form.receipt_url ? (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-400/30">
                  <ImageIcon className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex-1 truncate">Receipt uploaded ✅</span>
                  <button type="button" onClick={() => setForm(f => ({ ...f, receipt_url: '' }))}
                    className="text-muted-foreground hover:text-destructive">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-sm text-muted-foreground font-medium">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                  {uploading ? 'Uploading...' : 'Tap to capture / upload receipt'}
                </button>
              )}
            </div>

            <DialogFooter className="pt-4 border-t border-border gap-2">
              <Button type="button" variant="ghost" onClick={() => { setAddOpen(false); setForm(INIT_FORM); }}>Cancel</Button>
              <Button type="submit" disabled={submitting || !form.expense_title.trim() || !form.amount}
                className="shadow-lg shadow-primary/20 gap-2">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? 'Saving...' : 'Save Expense'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
