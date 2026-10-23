'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type {
  Hostel,
  Room,
  Bed,
  Tenant,
  Payment,
  Invoice,
  Profile,
  Complaint,
  MaintenanceTask,
  AICallLog,
  PlatformStats,
  AdminHostelOverview,
} from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface AdminContextValue {
  loading: boolean;
  isSuperAdmin: boolean;
  selectedHostelId: string | 'all';
  setSelectedHostelId: (id: string | 'all') => void;
  // Raw Collections
  hostels: Hostel[];
  hostelOverviews: AdminHostelOverview[];
  rooms: Room[];
  beds: Bed[];
  tenants: Tenant[];
  payments: Payment[];
  invoices: Invoice[];
  profiles: Profile[];
  complaints: Complaint[];
  maintenanceTasks: MaintenanceTask[];
  aiCallLogs: AICallLog[];
  // Aggregated Stats
  stats: PlatformStats;
  // Actions
  refreshAll: () => Promise<void>;
  createHostel: (hostelData: Partial<Hostel>) => Promise<{ data: Hostel | null; error: Error | null }>;
  updateHostel: (id: string, updates: Partial<Hostel>) => Promise<{ error: Error | null }>;
  deleteHostel: (id: string) => Promise<{ error: Error | null }>;
  recordPayment: (paymentData: {
    hostel_id: string;
    tenant_id: string;
    invoice_id?: string;
    amount: number;
    method: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'razorpay' | 'stripe';
    status: 'completed' | 'pending' | 'failed';
    notes?: string;
  }) => Promise<{ data: Payment | null; error: Error | null }>;
  toggleTenantAiCalls: (tenantId: string, pause: boolean) => Promise<{ error: Error | null }>;
  updateUserRole: (userId: string, newRole: Profile['role']) => Promise<{ error: Error | null }>;
  platformCommissionRate: number;
  setPlatformCommissionRate: (rate: number) => void;
}

const AdminContext = createContext<AdminContextValue | undefined>(undefined);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { session, profile } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [selectedHostelId, setSelectedHostelId] = useState<string | 'all'>('all');
  const [platformCommissionRate, setPlatformCommissionRate] = useState<number>(2.5);

  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>([]);
  const [aiCallLogs, setAiCallLogs] = useState<AICallLog[]>([]);

  const isSuperAdmin = useMemo(() => {
    if (!profile) return false;
    return profile.role === 'super_admin' && profile.active;
  }, [profile]);

  const loadAdminData = useCallback(async () => {
    if (!session?.user?.id || !profile || profile.role !== 'super_admin' || !profile.active) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Fetch all core datasets in parallel for maximum speed
      const [
        hostelsRes,
        roomsRes,
        bedsRes,
        tenantsRes,
        paymentsRes,
        invoicesRes,
        profilesRes,
        complaintsRes,
        maintenanceRes,
        aiLogsRes,
      ] = await Promise.all([
        supabase.from('hostels').select('*').order('created_at', { ascending: false }),
        supabase.from('rooms').select('*').order('room_number', { ascending: true }),
        supabase.from('beds').select('*'),
        supabase.from('tenants').select('*').order('created_at', { ascending: false }),
        supabase.from('payments').select('*').order('created_at', { ascending: false }),
        supabase.from('invoices').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('complaints').select('*').order('created_at', { ascending: false }),
        supabase.from('maintenance_tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('ai_call_logs').select('*').order('created_at', { ascending: false }),
      ]);

      if (hostelsRes.data) setHostels(hostelsRes.data as Hostel[]);
      if (roomsRes.data) setRooms(roomsRes.data as Room[]);
      if (bedsRes.data) setBeds(bedsRes.data as Bed[]);
      if (tenantsRes.data) setTenants(tenantsRes.data as Tenant[]);
      if (paymentsRes.data) setPayments(paymentsRes.data as Payment[]);
      if (invoicesRes.data) setInvoices(invoicesRes.data as Invoice[]);
      if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);
      if (complaintsRes.data) setComplaints(complaintsRes.data as Complaint[]);
      if (maintenanceRes.data) setMaintenanceTasks(maintenanceRes.data as MaintenanceTask[]);
      if (aiLogsRes.data) setAiCallLogs(aiLogsRes.data as AICallLog[]);
    } catch (err) {
      console.error('Failed to load admin data:', err);
      toast({
        title: 'Error loading admin data',
        description: 'Could not fetch all platform records.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, profile, toast]);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

  // Filtered datasets based on selectedHostelId
  const filteredHostels = useMemo(() => {
    if (selectedHostelId === 'all') return hostels;
    return hostels.filter((h) => h.id === selectedHostelId);
  }, [hostels, selectedHostelId]);

  const filteredRooms = useMemo(() => {
    if (selectedHostelId === 'all') return rooms;
    return rooms.filter((r) => r.hostel_id === selectedHostelId);
  }, [rooms, selectedHostelId]);

  const filteredBeds = useMemo(() => {
    if (selectedHostelId === 'all') return beds;
    const roomIds = new Set(filteredRooms.map((r) => r.id));
    return beds.filter((b) => roomIds.has(b.room_id));
  }, [beds, filteredRooms, selectedHostelId]);

  const filteredTenants = useMemo(() => {
    if (selectedHostelId === 'all') return tenants;
    return tenants.filter((t) => t.hostel_id === selectedHostelId);
  }, [tenants, selectedHostelId]);

  const filteredPayments = useMemo(() => {
    if (selectedHostelId === 'all') return payments;
    return payments.filter((p) => p.hostel_id === selectedHostelId);
  }, [payments, selectedHostelId]);

  const filteredInvoices = useMemo(() => {
    if (selectedHostelId === 'all') return invoices;
    return invoices.filter((i) => i.hostel_id === selectedHostelId);
  }, [invoices, selectedHostelId]);

  const filteredComplaints = useMemo(() => {
    if (selectedHostelId === 'all') return complaints;
    return complaints.filter((c) => c.hostel_id === selectedHostelId);
  }, [complaints, selectedHostelId]);

  const filteredMaintenance = useMemo(() => {
    if (selectedHostelId === 'all') return maintenanceTasks;
    return maintenanceTasks.filter((m) => m.hostel_id === selectedHostelId);
  }, [maintenanceTasks, selectedHostelId]);

  // Compute aggregated stats
  const stats: PlatformStats = useMemo(() => {
    const totalHostels = filteredHostels.length;
    const totalRooms = filteredRooms.length;
    const totalBeds = filteredBeds.length;
    const occupiedBeds = filteredBeds.filter((b) => b.status === 'occupied').length;
    const vacantBeds = filteredBeds.filter((b) => b.status === 'vacant').length;
    const totalTenants = filteredTenants.filter((t) => t.status === 'active').length;
    const totalOwners = profiles.filter((p) => p.role === 'hostel_owner' || p.role === 'super_admin').length;

    const totalRevenue = filteredPayments
      .filter((p) => p.status === 'completed')
      .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

    const pendingRevenue = filteredInvoices
      .filter((i) => i.status === 'pending' || i.status === 'overdue' || i.status === 'partial')
      .reduce((acc, i) => acc + Math.max(0, (Number(i.amount) || 0) - (Number(i.amount_paid) || 0)), 0);

    const totalInvoices = filteredInvoices.length;
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
    const activeComplaints = filteredComplaints.filter((c) => c.status !== 'resolved' && c.status !== 'closed').length;
    const activeMaintenance = filteredMaintenance.filter((m) => m.status !== 'completed').length;
    const totalAiCalls = aiCallLogs.length;

    return {
      totalHostels,
      totalRooms,
      totalBeds,
      occupiedBeds,
      vacantBeds,
      totalTenants,
      totalOwners,
      totalRevenue,
      pendingRevenue,
      totalInvoices,
      occupancyRate,
      activeComplaints,
      activeMaintenance,
      totalAiCalls,
    };
  }, [
    filteredHostels,
    filteredRooms,
    filteredBeds,
    filteredTenants,
    profiles,
    filteredPayments,
    filteredInvoices,
    filteredComplaints,
    filteredMaintenance,
    aiCallLogs,
  ]);

  // Comprehensive overview list per hostel
  const hostelOverviews: AdminHostelOverview[] = useMemo(() => {
    return hostels.map((hostel) => {
      const owner = profiles.find((p) => p.id === hostel.owner_id);
      const hostelRooms = rooms.filter((r) => r.hostel_id === hostel.id);
      const roomIds = new Set(hostelRooms.map((r) => r.id));
      const hostelBeds = beds.filter((b) => roomIds.has(b.room_id));
      const occupiedCount = hostelBeds.filter((b) => b.status === 'occupied').length;
      const hostelTenants = tenants.filter((t) => t.hostel_id === hostel.id && t.status === 'active');
      const hostelPayments = payments.filter((p) => p.hostel_id === hostel.id && p.status === 'completed');
      const totalRev = hostelPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
      const hostelInvoices = invoices.filter(
        (i) => i.hostel_id === hostel.id && (i.status === 'pending' || i.status === 'overdue' || i.status === 'partial')
      );
      const pendingRev = hostelInvoices.reduce(
        (acc, i) => acc + Math.max(0, (Number(i.amount) || 0) - (Number(i.amount_paid) || 0)),
        0
      );
      const occRate = hostelBeds.length > 0 ? Math.round((occupiedCount / hostelBeds.length) * 100) : 0;

      return {
        ...hostel,
        owner_name: owner?.full_name || 'Admin / Unknown',
        owner_email: owner?.email,
        owner_phone: owner?.phone,
        rooms_count: hostelRooms.length,
        beds_count: hostelBeds.length,
        occupied_beds_count: occupiedCount,
        active_tenants_count: hostelTenants.length,
        total_revenue: totalRev,
        pending_revenue: pendingRev,
        occupancy_rate: occRate,
      };
    });
  }, [hostels, profiles, rooms, beds, tenants, payments, invoices]);

  // Action: Create a new hostel
  const createHostel = async (hostelData: Partial<Hostel>) => {
    if (!session?.user?.id) {
      return { data: null, error: new Error('User not authenticated') };
    }

    try {
      const payload = {
        name: hostelData.name || 'New Hostel',
        address: hostelData.address || '',
        city: hostelData.city || '',
        state: hostelData.state || '',
        total_floors: Number(hostelData.total_floors) || 1,
        total_rooms: Number(hostelData.total_rooms) || 0,
        billing_day: Number(hostelData.billing_day) || 1,
        currency: hostelData.currency || 'INR',
        owner_id: hostelData.owner_id || session.user.id,
      };

      const { data, error } = await supabase.from('hostels').insert(payload).select().single();
      if (error) throw error;

      toast({
        title: 'Hostel Created',
        description: `Successfully added ${payload.name} to the platform.`,
      });

      await loadAdminData();
      return { data: data as Hostel, error: null };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Error creating hostel:', error);
      toast({
        title: 'Failed to create hostel',
        description: error.message,
        variant: 'destructive',
      });
      return { data: null, error };
    }
  };

  // Action: Update hostel
  const updateHostel = async (id: string, updates: Partial<Hostel>) => {
    try {
      const { error } = await supabase.from('hostels').update(updates).eq('id', id);
      if (error) throw error;

      toast({
        title: 'Hostel Updated',
        description: 'Hostel details saved successfully.',
      });

      await loadAdminData();
      return { error: null };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
      return { error };
    }
  };

  // Action: Delete hostel
  const deleteHostel = async (id: string) => {
    try {
      const { error } = await supabase.from('hostels').delete().eq('id', id);
      if (error) throw error;

      toast({
        title: 'Hostel Removed',
        description: 'The hostel and its linked structure have been deleted.',
      });

      await loadAdminData();
      return { error: null };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      toast({
        title: 'Delete Failed',
        description: error.message,
        variant: 'destructive',
      });
      return { error };
    }
  };

  // Action: Record payment across any hostel
  const recordPayment = async (paymentData: {
    hostel_id: string;
    tenant_id: string;
    invoice_id?: string;
    amount: number;
    method: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'razorpay' | 'stripe';
    status: 'completed' | 'pending' | 'failed';
    notes?: string;
  }) => {
    try {
      const payload = {
        hostel_id: paymentData.hostel_id,
        tenant_id: paymentData.tenant_id,
        invoice_id: paymentData.invoice_id || null,
        amount: paymentData.amount,
        method: paymentData.method,
        status: paymentData.status,
        notes: paymentData.notes || 'Recorded via Super Admin Dashboard',
        recorded_by: session?.user?.id,
      };

      const { data, error } = await supabase.from('payments').insert(payload).select().single();
      if (error) throw error;

      // If tied to an invoice and completed, update invoice amount_paid
      if (paymentData.invoice_id && paymentData.status === 'completed') {
        const inv = invoices.find((i) => i.id === paymentData.invoice_id);
        if (inv) {
          const newPaid = (Number(inv.amount_paid) || 0) + Number(paymentData.amount);
          const newStatus = newPaid >= Number(inv.amount) ? 'paid' : 'partial';
          await supabase.from('invoices').update({ amount_paid: newPaid, status: newStatus }).eq('id', inv.id);
        }
      }

      toast({
        title: 'Payment Recorded',
        description: `Successfully logged payment of ₹${paymentData.amount.toLocaleString('en-IN')}`,
      });

      await loadAdminData();
      return { data: data as Payment, error: null };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      toast({
        title: 'Payment Record Failed',
        description: error.message,
        variant: 'destructive',
      });
      return { data: null, error };
    }
  };

  // Action: Toggle AI voice calls for a tenant
  const toggleTenantAiCalls = async (tenantId: string, pause: boolean) => {
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ pause_ai_calls: pause })
        .eq('id', tenantId);

      if (error) throw error;

      toast({
        title: pause ? 'AI Calls Paused' : 'AI Calls Enabled',
        description: pause
          ? 'Automated reminder calls suspended for this tenant.'
          : 'Automated reminder calls activated for this tenant.',
      });

      await loadAdminData();
      return { error: null };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      toast({
        title: 'Action Failed',
        description: error.message,
        variant: 'destructive',
      });
      return { error };
    }
  };

  // Action: Update user role
  const updateUserRole = async (userId: string, newRole: Profile['role']) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Your session has expired. Sign in again.');

      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Role update failed.');

      toast({
        title: 'User Role Updated',
        description: `User role has been updated to ${newRole}.`,
      });

      await loadAdminData();
      return { error: null };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      toast({
        title: 'Role update failed',
        description: error.message,
        variant: 'destructive',
      });
      return { error };
    }
  };

  return (
    <AdminContext.Provider
      value={{
        loading,
        isSuperAdmin,
        selectedHostelId,
        setSelectedHostelId,
        hostels: filteredHostels,
        hostelOverviews,
        rooms: filteredRooms,
        beds: filteredBeds,
        tenants: filteredTenants,
        payments: filteredPayments,
        invoices: filteredInvoices,
        profiles,
        complaints: filteredComplaints,
        maintenanceTasks: filteredMaintenance,
        aiCallLogs,
        stats,
        refreshAll: loadAdminData,
        createHostel,
        updateHostel,
        deleteHostel,
        recordPayment,
        toggleTenantAiCalls,
        updateUserRole,
        platformCommissionRate,
        setPlatformCommissionRate,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}
