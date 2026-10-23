'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useHostelScope } from '@/hooks/use-hostel-scope';
import { NoHostelLinked } from '@/components/no-hostel-linked';
import { OnboardTenantDialog } from '@/components/onboard-tenant-dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Home,
  Users,
  AlertCircle,
  PhoneCall,
  Wrench,
  Clock,
  ArrowRight,
  Receipt,
  UserPlus,
  Building,
  Plus,
  Layers,
  DoorOpen,
} from 'lucide-react';
import Link from 'next/link';
import { AddRoomDialog } from '@/components/add-room-dialog';
import { AddFloorDialog } from '@/components/add-floor-dialog';
import type { Hostel, Invoice, Room, Tenant, Complaint, AICallLog, MaintenanceTask, Floor } from '@/lib/types';

interface DashboardData {
  hostel: Hostel | null;
  totalRevenue: number;
  pendingRent: number;
  occupancyRate: number;
  totalRooms: number;
  occupiedRooms: number;
  vacantRooms: number;
  maintenanceRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  totalTenants: number;
  activeTenants: number;
  settledInvoicesCount: number;
  overdueInvoices: Invoice[];
  recentComplaints: Complaint[];
  recentCalls: AICallLog[];
  pendingMaintenance: MaintenanceTask[];
}

export default function DashboardPage() {
  const { profile, hostelId, isReady, hasHostel } = useHostelScope();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [addRoomOpen, setAddRoomOpen] = useState(false);
  const [addFloorOpen, setAddFloorOpen] = useState(false);
  const [floors, setFloors] = useState<Floor[]>([]);

  const loadDashboard = useCallback(async () => {
    if (!isReady) return;
    if (!hostelId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const [
      { data: hostel },
      { data: rooms },
      { data: tenants },
      { data: invoices },
      { data: complaints },
      { data: aiCalls },
      { data: maintenance },
      { data: floorsData },
    ] = await Promise.all([
      supabase.from('hostels').select('*').eq('id', hostelId!).maybeSingle(),
      supabase.from('rooms').select('*, beds(*)').eq('hostel_id', hostelId!),
      supabase.from('tenants').select('*').eq('hostel_id', hostelId!),
      supabase.from('invoices').select('*, tenant:tenants(*)').eq('hostel_id', hostelId!).order('created_at', { ascending: false }),
      supabase.from('complaints').select('*, tenant:tenants(*)').eq('hostel_id', hostelId!).order('created_at', { ascending: false }).limit(5),
      supabase.from('ai_call_logs').select('*, tenant:tenants(*)').eq('hostel_id', hostelId!).order('created_at', { ascending: false }).limit(5),
      supabase.from('maintenance_tasks').select('*, room:rooms(*)').eq('hostel_id', hostelId!).eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
      supabase.from('floors').select('*').eq('hostel_id', hostelId!).order('floor_number', { ascending: true }),
    ]);

    const rawRooms = (rooms || []) as any[];
    const roomList = rawRooms.map((r) => {
      const roomBeds = r.beds || [];
      const occupiedBeds = roomBeds.filter((b: any) => b.status === 'occupied').length;
      let dynamicStatus = r.status;
      if (r.status !== 'maintenance') {
        dynamicStatus = occupiedBeds > 0 ? 'occupied' : 'vacant';
      }
      return {
        ...r,
        status: dynamicStatus,
        beds: roomBeds,
        occupiedBeds,
        totalBeds: roomBeds.length || r.capacity || 0,
      };
    });

    const tenantList = (tenants || []) as Tenant[];
    const invoiceList = (invoices || []) as Invoice[];
    const complaintList = (complaints || []) as Complaint[];
    const callList = (aiCalls || []) as AICallLog[];
    const maintenanceList = (maintenance || []) as MaintenanceTask[];
    
    setFloors((floorsData || []) as Floor[]);

    // Total revenue is ALL collected money across all invoices (full and partial)
    const totalRevenue = invoiceList.reduce((sum, i) => sum + Number(i.amount_paid || 0), 0);

    // Pending rent is remaining balance across all unpaid invoices
    const pendingRent = invoiceList.reduce(
      (sum, i) => sum + Math.max(0, Number(i.amount || 0) - Number(i.amount_paid || 0)),
      0
    );

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const overdueInvoices = invoiceList.filter(
      (i) => i.status === 'overdue' || (i.status !== 'paid' && new Date(i.due_date) < now)
    );
    const settledInvoicesCount = invoiceList.filter((i) => i.status === 'paid').length;

    const occupiedRooms = roomList.filter((r) => r.status === 'occupied').length;
    const vacantRooms = roomList.filter((r) => r.status === 'vacant').length;
    const maintenanceRooms = roomList.filter((r) => r.status === 'maintenance').length;
    const totalBeds = roomList.reduce((sum, r) => sum + r.totalBeds, 0);
    const occupiedBeds = roomList.reduce((sum, r) => sum + r.occupiedBeds, 0);
    const occupancyRate = totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : (roomList.length > 0 ? (occupiedRooms / roomList.length) * 100 : 0);

    setData({
      hostel: hostel as Hostel,
      totalRevenue,
      pendingRent,
      occupancyRate,
      totalRooms: roomList.length,
      occupiedRooms,
      vacantRooms,
      maintenanceRooms,
      totalBeds,
      occupiedBeds,
      totalTenants: tenantList.length,
      activeTenants: tenantList.filter((t) => t.status === 'active').length,
      settledInvoicesCount,
      overdueInvoices,
      recentComplaints: complaintList,
      recentCalls: callList,
      pendingMaintenance: maintenanceList,
    });
    setLoading(false);
  }, [hostelId, isReady]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-muted-foreground animate-pulse">
          <Building className="w-8 h-8 opacity-50" />
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (isReady && !hasHostel) {
    return <NoHostelLinked />;
  }

  if (!data?.hostel) {
    return null;
  }

  const stats = [
    {
      label: 'Total Revenue',
      value: `₹${data.totalRevenue.toLocaleString('en-IN')}`,
      icon: IndianRupee,
      color: 'from-emerald-500/20 to-emerald-400/5 border-emerald-400/40 text-emerald-600',
      iconColor: 'text-emerald-600',
      trend: `${data.settledInvoicesCount} invoices settled`,
      trendUp: true,
    },
    {
      label: 'Pending Rent',
      value: `₹${data.pendingRent.toLocaleString('en-IN')}`,
      icon: TrendingDown,
      color: data.pendingRent > 0 ? 'from-red-500/20 to-red-400/5 border-red-400/40 text-red-600' : 'from-emerald-500/20 to-emerald-400/5 border-emerald-400/40 text-emerald-600',
      iconColor: data.pendingRent > 0 ? 'text-red-600' : 'text-emerald-600',
      trend: `${data.overdueInvoices.length} invoices overdue`,
      trendUp: false,
    },
    {
      label: 'Occupancy Rate',
      value: `${data.occupancyRate.toFixed(0)}%`,
      icon: Home,
      color: 'from-blue-500/20 to-blue-400/5 border-blue-400/40 text-blue-600',
      iconColor: 'text-blue-600',
      trend: `${data.occupiedBeds}/${data.totalBeds} beds (${data.occupiedRooms}/${data.totalRooms} rooms)`,
      trendUp: true,
    },
    {
      label: 'Active Tenants',
      value: `${data.activeTenants}`,
      icon: Users,
      color: 'from-amber-500/20 to-amber-400/5 border-amber-400/40 text-amber-600',
      iconColor: 'text-amber-600',
      trend: `${data.totalTenants} total registered`,
      trendUp: true,
    },
  ];

  return (
    <div className="space-y-8 pb-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight">{data.hostel.name}</h1>
          <p className="text-muted-foreground mt-2 font-medium flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            {data.hostel.city}, {data.hostel.state}
            <span className="mx-2 text-border">|</span>
            Billing cycle: Day {data.hostel.billing_day}
          </p>
        </div>
        
        {/* Quick Actions Panel - Side-by-side on mobile */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2.5 w-full sm:w-auto">
          <Button
            variant="default"
            onClick={() => setOnboardOpen(true)}
            className="w-full sm:w-auto shadow-lg shadow-primary/20 text-xs sm:text-sm h-10 px-2 sm:px-4 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 shrink-0" />
            <span className="truncate">Onboard Tenant</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => setAddRoomOpen(true)}
            className="w-full sm:w-auto shadow-sm text-xs sm:text-sm h-10 px-2 sm:px-4 cursor-pointer hover:bg-secondary"
          >
            <DoorOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 shrink-0 text-primary" />
            <span className="truncate">Add Room</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => setAddFloorOpen(true)}
            className="w-full sm:w-auto shadow-sm text-xs sm:text-sm h-10 px-2 sm:px-4 cursor-pointer hover:bg-secondary hidden sm:inline-flex"
          >
            <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 shrink-0 text-primary" />
            <span className="truncate">Add Floor</span>
          </Button>
          <Link href="/app/payments" className="w-full sm:w-auto">
            <Button variant="secondary" className="w-full shadow-sm text-xs sm:text-sm h-10 px-2 sm:px-4">
              <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 shrink-0" />
              <span className="truncate">Collect Payment</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid - 2 side-by-side on mobile, compact like rooms page */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={`relative overflow-hidden rounded-xl border bg-gradient-to-br p-3.5 sm:p-4 ${stat.color} transition-all hover:scale-[1.02] hover:shadow-md flex flex-col justify-between`}
            >
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-[11px] sm:text-xs font-semibold opacity-85 truncate">
                  {stat.label}
                </span>
                <div className="p-1.5 rounded-lg bg-background/50 backdrop-blur-sm shadow-sm shrink-0">
                  <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${stat.iconColor}`} />
                </div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight truncate">
                  {stat.value}
                </div>
                <div className="flex items-center gap-1 opacity-75 mt-0.5 text-[10px] sm:text-xs font-medium truncate">
                  {stat.trendUp ? (
                    <TrendingUp className="w-3 h-3 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3 h-3 shrink-0" />
                  )}
                  <span className="truncate">{stat.trend}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Overdue Invoices Alert Section */}
          <Card className="border-red-500/20 shadow-lg shadow-red-500/5">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg text-red-600 dark:text-red-400">
                  <AlertCircle className="w-5 h-5" />
                  Critical Overdue Invoices
                </CardTitle>
                <CardDescription>Requires immediate attention</CardDescription>
              </div>
              <Link href="/app/payments">
                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {data.overdueInvoices.length === 0 ? (
                <div className="text-center py-6 text-emerald-600 flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <p className="font-medium">All clear! No overdue invoices.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.overdueInvoices.slice(0, 5).map((inv) => (
                    <div key={inv.id} className="group flex items-center justify-between p-3 rounded-xl border border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center text-red-600 font-bold">
                          {inv.tenant?.full_name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{inv.tenant?.full_name || 'Unknown Tenant'}</p>
                          <p className="text-xs text-muted-foreground font-mono">{inv.invoice_number}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-600">
                          ₹{(Number(inv.amount) - Number(inv.amount_paid)).toLocaleString('en-IN')}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3" /> Due {new Date(inv.due_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Maintenance */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Wrench className="w-5 h-5 text-amber-500" />
                  Pending Maintenance
                </CardTitle>
                <CardDescription>Active repair and cleaning tasks</CardDescription>
              </div>
              <Link href="/app/maintenance">
                <Button variant="ghost" size="sm">
                  Manage <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {data.pendingMaintenance.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No pending maintenance tasks.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.pendingMaintenance.map((task) => (
                    <div key={task.id} className="p-3 rounded-xl border border-border bg-card hover:border-amber-500/50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline" className="capitalize bg-amber-500/10 text-amber-600 border-amber-200">
                          {task.task_type}
                        </Badge>
                        <span className="text-xs font-semibold px-2 py-1 bg-secondary rounded-md">
                          Room {task.room?.room_number}
                        </span>
                      </div>
                      <p className="text-sm font-medium line-clamp-2 mb-2">
                        {task.notes || 'No description provided.'}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Reported: {new Date(task.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Side Column (1/3 width) */}
        <div className="space-y-6">
          
          {/* Occupancy Overview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Occupancy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-3xl font-black text-primary">{data.occupancyRate.toFixed(1)}%</span>
                  <span className="text-sm text-muted-foreground mb-1">Filled</span>
                </div>
                <Progress value={data.occupancyRate} className="h-4 rounded-full" />
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-xl text-center border border-emerald-100 dark:border-emerald-900">
                  <div className="text-lg font-bold text-emerald-600">{data.vacantRooms}</div>
                  <div className="text-[10px] font-medium text-emerald-600/80 uppercase tracking-wider">Vacant</div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/30 p-2 rounded-xl text-center border border-blue-100 dark:border-blue-900">
                  <div className="text-lg font-bold text-blue-600">{data.occupiedRooms}</div>
                  <div className="text-[10px] font-medium text-blue-600/80 uppercase tracking-wider">Occupied</div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/30 p-2 rounded-xl text-center border border-amber-100 dark:border-amber-900">
                  <div className="text-lg font-bold text-amber-600">{data.maintenanceRooms}</div>
                  <div className="text-[10px] font-medium text-amber-600/80 uppercase tracking-wider">Maint.</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent AI Calls */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <PhoneCall className="w-5 h-5 text-indigo-500" />
                AI Agent Log
              </CardTitle>
              <Link href="/app/ai-calls">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.recentCalls.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No recent AI activity</p>
              ) : (
                <div className="space-y-3">
                  {data.recentCalls.map((call) => (
                    <div key={call.id} className="flex flex-col p-3 rounded-xl border border-border bg-card/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm">{call.tenant_name}</span>
                        <Badge
                          variant={
                            call.call_status === 'promised_to_pay' ? 'default' :
                            call.call_status === 'call_failed' ? 'destructive' :
                            call.call_status === 'escalated' ? 'destructive' : 'secondary'
                          }
                          className="text-[10px] px-1.5 py-0"
                        >
                          {call.call_status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{call.days_overdue} days overdue</span>
                        <span>₹{Number(call.amount_due).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
        </div>
      </div>

      {/* Onboard Tenant Dialog directly on Dashboard */}
      <OnboardTenantDialog
        open={onboardOpen}
        onOpenChange={setOnboardOpen}
        hostelId={hostelId}
        userId={profile?.id}
        onSuccess={loadDashboard}
      />

      {/* Add Room Dialog directly on Dashboard */}
      <AddRoomDialog
        open={addRoomOpen}
        onOpenChange={setAddRoomOpen}
        hostelId={hostelId}
        floors={floors}
        onSuccess={loadDashboard}
        onOpenAddFloor={() => setAddFloorOpen(true)}
      />

      {/* Add Floor Dialog directly on Dashboard */}
      <AddFloorDialog
        open={addFloorOpen}
        onOpenChange={setAddFloorOpen}
        hostelId={hostelId}
        existingFloors={floors}
        onSuccess={loadDashboard}
      />
    </div>
  );
}
