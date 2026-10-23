'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useHostelScope } from '@/hooks/use-hostel-scope';
import { NoHostelLinked } from '@/components/no-hostel-linked';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import {
  BedDouble,
  Users,
  IndianRupee,
  Phone,
  Camera,
  CheckCircle2,
  Wrench,
  Search,
  Building2,
  AlertCircle,
  Layers,
  Plus,
  DoorOpen,
  ChevronRight,
} from 'lucide-react';
import { AddRoomDialog } from '@/components/add-room-dialog';
import { AddFloorDialog } from '@/components/add-floor-dialog';
import { OnboardTenantDialog } from '@/components/onboard-tenant-dialog';
import type { Room, Bed, Tenant, Floor, RoomStatus } from '@/lib/types';

interface BedWithTenant extends Bed {
  tenant?: Tenant;
  due?: number;
}

interface RoomWithDetails extends Room {
  beds: BedWithTenant[];
  floor?: Floor;
  due?: number;
}

type RoomFilterStatus = 'all' | 'vacant' | 'occupied' | 'maintenance';

function roomCardStyle(room: RoomWithDetails) {
  const hasDue = (room.due ?? 0) > 0;
  if (hasDue) return { border: 'border-red-400/60', bg: 'bg-gradient-to-br from-red-500/10 via-red-400/5 to-transparent', glow: 'shadow-red-500/10', accent: '#ef4444' };
  switch (room.status) {
    case 'vacant': return { border: 'border-emerald-400/50', bg: 'bg-gradient-to-br from-emerald-500/10 via-emerald-400/5 to-transparent', glow: 'shadow-emerald-500/10', accent: '#10b981' };
    case 'occupied': return { border: 'border-blue-400/50', bg: 'bg-gradient-to-br from-blue-500/10 via-blue-400/5 to-transparent', glow: 'shadow-blue-500/10', accent: '#3b82f6' };
    case 'maintenance': return { border: 'border-amber-400/50', bg: 'bg-gradient-to-br from-amber-500/10 via-amber-400/5 to-transparent', glow: 'shadow-amber-500/10', accent: '#f59e0b' };
    default: return { border: 'border-border', bg: 'bg-card', glow: '', accent: '#6b7280' };
  }
}

function bedDotStyle(bed: BedWithTenant, due: number): string {
  if (bed.status === 'occupied' && due > 0) return 'bg-red-500 ring-2 ring-red-300/50';
  switch (bed.status) {
    case 'vacant': return 'bg-emerald-500';
    case 'occupied': return 'bg-blue-500';
    case 'maintenance': return 'bg-amber-500';
    default: return 'bg-slate-400';
  }
}

function StatusPill({ status, due }: { status: string; due: number }) {
  if (status === 'occupied' && due > 0)
    return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-500 border border-red-400/30"><AlertCircle className="w-2.5 h-2.5" />Overdue</span>;
  if (status === 'vacant')
    return <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-400/30">Vacant</span>;
  if (status === 'occupied')
    return <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 border border-blue-400/30">Occupied</span>;
  if (status === 'maintenance')
    return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 border border-amber-400/30"><Wrench className="w-2.5 h-2.5" />Maint.</span>;
  return null;
}

function FloorStats({ rooms }: { rooms: RoomWithDetails[] }) {
  const vacant = rooms.filter((r) => r.status === 'vacant').length;
  const occupied = rooms.filter((r) => r.status === 'occupied').length;
  const maintenance = rooms.filter((r) => r.status === 'maintenance').length;
  const overdue = rooms.filter((r) => (r.due ?? 0) > 0).length;
  const totalBeds = rooms.reduce((s, r) => s + r.beds.length, 0);
  const occupiedBeds = rooms.reduce((s, r) => s + r.beds.filter((b) => b.status === 'occupied').length, 0);
  return (
    <div className="flex flex-wrap gap-3 text-xs mt-0.5">
      <span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{vacant} Vacant</span>
      <span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />{occupied} Occupied</span>
      {maintenance > 0 && <span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />{maintenance} Maint.</span>}
      {overdue > 0 && <span className="flex items-center gap-1.5 text-red-500 font-medium"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{overdue} Overdue</span>}
      <span className="flex items-center gap-1.5 text-muted-foreground ml-auto"><Users className="w-3 h-3" />{occupiedBeds}/{totalBeds} beds</span>
    </div>
  );
}

function RoomCard({ room, onClick }: { room: RoomWithDetails; onClick: () => void }) {
  const style = roomCardStyle(room);
  const due = room.due ?? 0;
  return (
    <button onClick={onClick} className={`relative text-left rounded-2xl border-2 ${style.border} ${style.bg} shadow-lg p-4 transition-all duration-200 hover:scale-[1.03] hover:shadow-xl group w-full`}>
      <div className="absolute top-0 left-4 right-4 h-0.5 rounded-full opacity-60" style={{ backgroundColor: style.accent }} />
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Room</p>
          <p className="text-xl font-black leading-tight" style={{ color: style.accent }}>#{room.room_number}</p>
        </div>
        <StatusPill status={room.status} due={due} />
      </div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wider capitalize">{room.room_type}</span>
        <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Users className="w-2.5 h-2.5" />{room.capacity} sharing</span>
      </div>
      <div className="flex gap-1.5 flex-wrap mb-3">
        {room.beds.length > 0 ? room.beds.map((bed) => (
          <div key={bed.id} title={`${bed.bed_label}${bed.tenant ? ` — ${bed.tenant.full_name}` : ' — Vacant'}`}
            className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold transition-transform group-hover:scale-110 ${bedDotStyle(bed, due)}`}>
            {bed.bed_label.replace(/[^0-9]/g, '') || bed.bed_label.slice(-1)}
          </div>
        )) : <span className="text-[10px] text-muted-foreground italic">No beds</span>}
      </div>
      <div className="border-t border-border/50 pt-2 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1"><IndianRupee className="w-2.5 h-2.5" />Rent</span>
          <span className="text-xs font-semibold">₹{Number(room.monthly_rent).toLocaleString('en-IN')}<span className="text-[9px] text-muted-foreground font-normal">/mo</span></span>
        </div>
        {due > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-red-500 flex items-center gap-1 font-medium"><AlertCircle className="w-2.5 h-2.5" />Due</span>
            <span className="text-xs font-bold text-red-500">₹{due.toLocaleString('en-IN')}</span>
          </div>
        )}
        {due === 0 && room.status === 'occupied' && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-emerald-600 flex items-center gap-1 font-medium"><CheckCircle2 className="w-2.5 h-2.5" />Clear</span>
            <span className="text-[10px] text-emerald-600 font-semibold">No dues</span>
          </div>
        )}
      </div>
    </button>
  );
}

export default function RoomsPage() {
  const { profile, hostelId, isReady, hasHostel } = useHostelScope();
  const { toast } = useToast();
  const [rooms, setRooms] = useState<RoomWithDetails[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<RoomFilterStatus>('all');
  const [search, setSearch] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<RoomWithDetails | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Per-bed payment state: bedId -> { amount, method }
  const [bedPayments, setBedPayments] = useState<Record<string, { amount: string; method: string }>>({});
  const [recordingBed, setRecordingBed] = useState<string | null>(null);
  const [hostelTotalDue, setHostelTotalDue] = useState(0);
  const [addRoomOpen, setAddRoomOpen] = useState(false);
  const [addFloorOpen, setAddFloorOpen] = useState(false);
  const [editRent, setEditRent] = useState('');
  const [editCapacity, setEditCapacity] = useState<number>(1);
  const [editSaving, setEditSaving] = useState(false);
  // Tenant onboard dialog state
  const [tenantDialogOpen, setTenantDialogOpen] = useState(false);
  const [tenantDialogBedId, setTenantDialogBedId] = useState<string | undefined>(undefined);
  const [tenantDialogRoomId, setTenantDialogRoomId] = useState<string | undefined>(undefined);
  // Expanded bed in sheet (for occupied bed detail view)
  const [expandedBedId, setExpandedBedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;
    if (!hostelId) { setLoading(false); return; }
    loadData(hostelId);
  }, [isReady, hostelId]);

  async function loadData(hid: string) {
    setLoading(true);
    const [{ data: roomData }, { data: floorData }, { data: invoiceData }] = await Promise.all([
      supabase.from('rooms').select('*, beds(*, tenant:tenants!beds_tenant_id_fkey(*)), floor:floors(*)').eq('hostel_id', hid).order('room_number'),
      supabase.from('floors').select('*').eq('hostel_id', hid).order('floor_number'),
      supabase.from('invoices').select('tenant_id, amount, amount_paid, status, due_date').eq('hostel_id', hid).in('status', ['pending', 'partial', 'overdue']),
    ]);

    const dueMap: Record<string, number> = {};
    let totalHostelDue = 0;
    for (const inv of invoiceData ?? []) {
      const outstanding = Math.max(0, Number(inv.amount || 0) - Number(inv.amount_paid || 0));
      if (outstanding > 0) {
        dueMap[inv.tenant_id] = (dueMap[inv.tenant_id] ?? 0) + outstanding;
        totalHostelDue += outstanding;
      }
    }

    const enriched: RoomWithDetails[] = (roomData ?? []).map((r: any) => {
      const roomBeds = (r.beds || []) as BedWithTenant[];
      const occupiedBeds = roomBeds.filter((b) => b.status === 'occupied').length;
      let dynamicStatus: RoomStatus = r.status;
      if (r.status !== 'maintenance') {
        dynamicStatus = occupiedBeds > 0 ? 'occupied' : 'vacant';
      }
      return {
        ...r,
        status: dynamicStatus,
        beds: roomBeds.map((b) => ({
          ...b,
          due: b.tenant_id ? (dueMap[b.tenant_id] ?? 0) : 0,
        })),
        due: roomBeds.reduce((sum: number, bed: BedWithTenant) => sum + (bed.tenant_id ? (dueMap[bed.tenant_id] ?? 0) : 0), 0),
      };
    });

    setRooms(enriched);
    setSelectedRoom((current) =>
      current ? enriched.find((room) => room.id === current.id) ?? current : current
    );
    setHostelTotalDue(totalHostelDue);
    setFloors((floorData ?? []) as Floor[]);
    setLoading(false);
  }

  const roomsByFloor = useMemo(() => {
    const floorMap: Record<string, { floor: Floor; rooms: RoomWithDetails[] }> = {};
    const noFloor: RoomWithDetails[] = [];
    for (const room of rooms) {
      if (statusFilter !== 'all' && room.status !== statusFilter) continue;
      if (search && !room.room_number.toLowerCase().includes(search.toLowerCase())) continue;
      if (room.floor) {
        const key = room.floor.id;
        if (!floorMap[key]) floorMap[key] = { floor: room.floor, rooms: [] };
        floorMap[key].rooms.push(room);
      } else {
        noFloor.push(room);
      }
    }
    const sorted = Object.values(floorMap).sort((a, b) => a.floor.floor_number - b.floor.floor_number);
    return { sorted, noFloor };
  }, [rooms, statusFilter, search]);

  const stats = useMemo(() => {
    const vacant = rooms.filter((r) => r.status === 'vacant').length;
    const occupied = rooms.filter((r) => r.status === 'occupied').length;
    const maintenance = rooms.filter((r) => r.status === 'maintenance').length;
    const totalDue = hostelTotalDue;
    const totalBeds = rooms.reduce((s, r) => s + r.beds.length, 0);
    const occupiedBeds = rooms.reduce((s, r) => s + r.beds.filter((b) => b.status === 'occupied').length, 0);
    return { total: rooms.length, vacant, occupied, maintenance, totalDue, totalBeds, occupiedBeds };
  }, [rooms, hostelTotalDue]);

  async function handleRecordBedPayment(bedId: string, tenantId: string) {
    const pay = bedPayments[bedId];
    if (!profile?.hostel_id || !pay?.amount) return;
    const amountNum = parseFloat(pay.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ title: 'Enter a valid amount', variant: 'destructive' }); return;
    }
    setRecordingBed(bedId);
    try {
      const { data: pendingInvoices } = await supabase
        .from('invoices').select('*')
        .eq('tenant_id', tenantId)
        .in('status', ['pending', 'partial', 'overdue'])
        .order('due_date', { ascending: true });

      if (!pendingInvoices || pendingInvoices.length === 0) {
        toast({ title: 'No pending invoice for this tenant', variant: 'destructive' }); return;
      }

      let remainingPayment = amountNum;
      for (const invoice of pendingInvoices) {
        if (remainingPayment <= 0) break;
        const invoiceDue = Math.max(0, Number(invoice.amount || 0) - Number(invoice.amount_paid || 0));
        const payForThisInvoice = Math.min(remainingPayment, invoiceDue > 0 ? invoiceDue : remainingPayment);

        await supabase.from('payments').insert({
          invoice_id: invoice.id,
          tenant_id: tenantId,
          hostel_id: profile.hostel_id,
          amount: payForThisInvoice,
          method: pay.method || 'cash',
          status: 'completed',
          recorded_by: profile.id,
        });

        const newPaid = Number(invoice.amount_paid || 0) + payForThisInvoice;
        const newStatus = newPaid >= Number(invoice.amount) ? 'paid' : 'partial';
        await supabase.from('invoices').update({ amount_paid: newPaid, status: newStatus }).eq('id', invoice.id);

        remainingPayment -= payForThisInvoice;
      }

      toast({
        title: '✅ Payment recorded',
        description: `₹${amountNum.toLocaleString('en-IN')} via ${pay.method || 'cash'} for ${selectedRoom?.beds.find(b => b.id === bedId)?.tenant?.full_name}`,
      });
      // Clear the bed entry
      setBedPayments(prev => { const n = { ...prev }; delete n[bedId]; return n; });
      loadData(profile.hostel_id);
    } finally {
      setRecordingBed(null);
    }
  }

  async function handleMarkMaintenance(roomId: string) {
    if (!profile?.hostel_id) return;
    await supabase.from('rooms').update({ status: 'maintenance' }).eq('id', roomId);
    await supabase.from('maintenance_tasks').insert({ hostel_id: profile.hostel_id, room_id: roomId, task_type: 'repair', status: 'pending' });
    toast({ title: 'Room marked for maintenance' });
    loadData(profile.hostel_id);
  }

  async function handleSaveRoomSettings() {
    if (!selectedRoom || !profile?.hostel_id) return;
    const rentNum = parseFloat(editRent);
    if (isNaN(rentNum) || rentNum <= 0) {
      toast({ title: 'Invalid rent amount', variant: 'destructive' });
      return;
    }
    if (editCapacity < 1 || editCapacity > 10) {
      toast({ title: 'Capacity must be between 1 and 10', variant: 'destructive' });
      return;
    }
    setEditSaving(true);
    try {
      const { error } = await supabase.rpc('update_room_inventory', {
        p_room_id: selectedRoom.id,
        p_monthly_rent: rentNum,
        p_capacity: editCapacity,
      });
      if (error) {
        toast({
          title: 'Could not save room settings',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Room settings saved', description: `₹${rentNum.toLocaleString('en-IN')}/mo · ${editCapacity} bed capacity` });
      await loadData(profile.hostel_id);
    } catch (error) {
      toast({
        title: 'Could not save room settings',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setEditSaving(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="text-muted-foreground animate-pulse">Loading hostel structure…</div></div>;
  if (isReady && !hasHostel) return <NoHostelLinked />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Room Structure</h1>
          <p className="text-muted-foreground mt-1 text-sm">{floors.length} floors · {stats.total} rooms · {stats.totalBeds} beds</p>
        </div>

        {/* Action Buttons: Add Floor & Add Room */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddFloorOpen(true)}
            className="h-9 px-3 rounded-xl text-xs font-semibold hover:bg-secondary border-border"
          >
            <Layers className="w-3.5 h-3.5 mr-1.5 text-primary" />
            Add Floor
          </Button>

          <Button
            size="sm"
            onClick={() => setAddRoomOpen(true)}
            className="h-9 px-3.5 rounded-xl text-xs font-semibold shadow-md shadow-primary/20 bg-primary text-primary-foreground"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Room
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Vacant Rooms', value: stats.vacant, sub: `${stats.totalBeds - stats.occupiedBeds} beds free`, color: 'from-emerald-500/20 to-emerald-400/5 border-emerald-400/40 text-emerald-600', icon: <BedDouble className="w-4 h-4" /> },
          { label: 'Occupied', value: stats.occupied, sub: `${stats.occupiedBeds} beds taken`, color: 'from-blue-500/20 to-blue-400/5 border-blue-400/40 text-blue-600', icon: <Users className="w-4 h-4" /> },
          { label: 'Maintenance', value: stats.maintenance, sub: 'rooms offline', color: 'from-amber-500/20 to-amber-400/5 border-amber-400/40 text-amber-600', icon: <Wrench className="w-4 h-4" /> },
          { label: 'Total Dues', value: `₹${stats.totalDue.toLocaleString('en-IN')}`, sub: 'outstanding rent', color: stats.totalDue > 0 ? 'from-red-500/20 to-red-400/5 border-red-400/40 text-red-600' : 'from-emerald-500/20 to-emerald-400/5 border-emerald-400/40 text-emerald-600', icon: <IndianRupee className="w-4 h-4" /> },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border bg-gradient-to-br p-4 ${s.color}`}>
            <div className="flex items-center justify-between mb-1"><span className="text-xs font-medium opacity-80">{s.label}</span>{s.icon}</div>
            <p className="text-2xl font-black">{s.value}</p>
            <p className="text-[10px] opacity-60 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search room number…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as RoomFilterStatus)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="vacant">Vacant</TabsTrigger>
            <TabsTrigger value="occupied">Occupied</TabsTrigger>
            <TabsTrigger value="maintenance">Maint.</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Floor sections */}
      {roomsByFloor.sorted.length === 0 && roomsByFloor.noFloor.length === 0 ? (
        <div className="border-2 border-dashed rounded-3xl flex flex-col items-center justify-center py-20 text-center gap-3 bg-card/40">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground">
            <BedDouble className="w-7 h-7" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-foreground">No Rooms Configured</h3>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1 max-w-sm mx-auto">
              {search ? 'No rooms match your search query.' : 'Add your first building floor and rooms to start allocating beds to tenants.'}
            </p>
          </div>
          {!search && (
            <div className="flex items-center gap-2 mt-2">
              <Button onClick={() => setAddFloorOpen(true)} variant="outline" size="sm" className="rounded-xl">
                <Layers className="w-3.5 h-3.5 mr-1.5 text-primary" /> Add Floor
              </Button>
              <Button onClick={() => setAddRoomOpen(true)} size="sm" className="rounded-xl shadow-md shadow-primary/20">
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Room
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-10">
          {roomsByFloor.sorted.map(({ floor, rooms: floorRooms }) => (
            <section key={floor.id}>
              {/* Floor header */}
              <div className="flex items-center gap-3 mb-5">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-bold text-lg">{floor.name || `Floor ${floor.floor_number}`}</h2>
                    <span className="text-sm font-normal text-muted-foreground">· {floorRooms.length} rooms</span>
                    <button
                      onClick={() => setAddRoomOpen(true)}
                      className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 ml-1"
                    >
                      <Plus className="w-3 h-3" /> Add Room
                    </button>
                  </div>
                  <FloorStats rooms={floorRooms} />
                </div>
                {/* Occupancy bar */}
                <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                  <span className="text-[10px] text-muted-foreground">
                    {Math.round((floorRooms.filter((r) => r.status === 'occupied').length / floorRooms.length) * 100)}% occupied
                  </span>
                  <div className="w-28 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${(floorRooms.filter((r) => r.status === 'occupied').length / floorRooms.length) * 100}%` }} />
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-gradient-to-r from-primary/20 via-border to-transparent mb-5" />

              {/* Room grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {floorRooms.map((room) => (
                  <RoomCard key={room.id} room={room} onClick={() => { setSelectedRoom(room); setEditRent(String(room.monthly_rent)); setEditCapacity(room.capacity); setSheetOpen(true); }} />
                ))}
              </div>
            </section>
          ))}

          {roomsByFloor.noFloor.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-5">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted border border-border shrink-0">
                  <BedDouble className="w-5 h-5 text-muted-foreground" />
                </div>
                <h2 className="font-bold text-lg">Other Rooms</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {roomsByFloor.noFloor.map((room) => (
                  <RoomCard key={room.id} room={room} onClick={() => { setSelectedRoom(room); setEditRent(String(room.monthly_rent)); setEditCapacity(room.capacity); setSheetOpen(true); }} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Room Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={(open) => {
        setSheetOpen(open);
        if (open && selectedRoom) {
          setEditRent(String(selectedRoom.monthly_rent));
          setEditCapacity(selectedRoom.capacity);
        }
      }}>
        <SheetContent side="right" className="w-full sm:w-[440px] overflow-y-auto">
          {selectedRoom && (
            <>
              <SheetHeader className="pb-4 border-b border-border">
                <SheetTitle className="flex items-center gap-3 text-xl">
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-black" style={{ backgroundColor: roomCardStyle(selectedRoom).accent }}>
                    {selectedRoom.room_number}
                  </span>
                  Room {selectedRoom.room_number}
                </SheetTitle>
                <SheetDescription className="flex flex-wrap gap-2 mt-2">
                  <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-muted capitalize">{selectedRoom.room_type}</span>
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted"><Users className="w-3 h-3" />{selectedRoom.capacity} sharing</span>
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted"><IndianRupee className="w-3 h-3" />₹{Number(selectedRoom.monthly_rent).toLocaleString('en-IN')}/mo</span>
                  {(selectedRoom.due ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 font-semibold">
                      <AlertCircle className="w-3 h-3" />₹{(selectedRoom.due ?? 0).toLocaleString('en-IN')} due
                    </span>
                  )}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-5 space-y-6">
                {/* Beds - Clickable */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><BedDouble className="w-4 h-4" />Beds in this room
                    <span className="ml-auto text-[10px] font-normal text-muted-foreground">Click a bed to manage</span>
                  </h4>
                  <div className="space-y-2">
                    {selectedRoom.beds.map((bed) => {
                      const bedDue = (bed as BedWithTenant).due ?? 0;
                      const isExpanded = expandedBedId === bed.id;
                      const isVacant = bed.status === 'vacant';
                      const isMaintenance = bed.status === 'maintenance';
                      return (
                        <div key={bed.id}>
                          <button
                            type="button"
                            onClick={() => {
                              if (isVacant) {
                                setTenantDialogRoomId(selectedRoom.id);
                                setTenantDialogBedId(bed.id);
                                setTenantDialogOpen(true);
                              } else if (!isMaintenance) {
                                setExpandedBedId(isExpanded ? null : bed.id);
                              }
                            }}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all duration-200 text-left group ${
                              bedDue > 0
                                ? 'border-red-300/60 bg-red-500/5 hover:bg-red-500/10'
                                : isVacant
                                ? 'border-emerald-300/50 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-400'
                                : isMaintenance
                                ? 'border-amber-300/50 bg-amber-500/5'
                                : 'border-blue-300/50 bg-blue-500/5 hover:bg-blue-500/10'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 transition-transform group-hover:scale-105 ${bedDotStyle(bed, bedDue)}`}>
                                {bed.bed_label.replace(/[^0-9]/g, '') || bed.bed_label.slice(-1)}
                              </div>
                              <div>
                                <p className="text-sm font-semibold">{bed.bed_label}</p>
                                <p className="text-xs text-muted-foreground">
                                  {isVacant ? (
                                    <span className="text-emerald-600 font-medium">✦ Click to add tenant</span>
                                  ) : (
                                    bed.tenant?.full_name ?? 'Occupied'
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {bedDue > 0 && (
                                <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">Due ₹{bedDue.toLocaleString('en-IN')}</span>
                              )}
                              <StatusPill status={bed.status} due={bedDue} />
                              {!isMaintenance && !isVacant && (
                                <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              )}
                              {isVacant && <Plus className="w-3.5 h-3.5 text-emerald-600" />}
                            </div>
                          </button>

                          {/* Expanded occupied bed detail */}
                          {isExpanded && bed.tenant && (
                            <div className="mt-1 mx-1 p-3 rounded-xl border border-blue-200/30 bg-blue-500/5 space-y-2 text-xs">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <p className="text-muted-foreground font-medium uppercase tracking-wider text-[9px]">Monthly Rent</p>
                                  <p className="font-bold text-sm text-foreground">₹{Number(bed.tenant.monthly_rent || selectedRoom.monthly_rent).toLocaleString('en-IN')}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground font-medium uppercase tracking-wider text-[9px]">Due Day</p>
                                  <p className="font-bold text-sm text-foreground">{bed.tenant.rent_due_day || 1}st of month</p>
                                </div>
                                {bed.tenant.agreement_start && (
                                  <div>
                                    <p className="text-muted-foreground font-medium uppercase tracking-wider text-[9px]">Move-in Date</p>
                                    <p className="font-semibold text-foreground">{new Date(bed.tenant.agreement_start).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                  </div>
                                )}
                                {bed.tenant.agreement_end && (
                                  <div>
                                    <p className="text-muted-foreground font-medium uppercase tracking-wider text-[9px]">Agreement End</p>
                                    <p className="font-semibold text-foreground">{new Date(bed.tenant.agreement_end).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                  </div>
                                )}
                                <div className="col-span-2">
                                  <p className="text-muted-foreground font-medium uppercase tracking-wider text-[9px]">Outstanding Due</p>
                                  <p className={`font-bold text-base ${bedDue > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                    {bedDue > 0 ? `₹${bedDue.toLocaleString('en-IN')} overdue` : '✅ All clear — no dues'}
                                  </p>
                                </div>
                              </div>
                              {bed.tenant.phone && (
                                <a href={`tel:${bed.tenant.phone}`} className="flex items-center gap-2 text-primary hover:underline font-medium">
                                  <Phone className="w-3 h-3" /> {bed.tenant.phone}
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Call tenants */}
                {selectedRoom.beds.some((b) => b.tenant?.phone) && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Phone className="w-4 h-4" />Call Tenants</h4>
                    <div className="space-y-2">
                      {selectedRoom.beds.filter((b) => b.tenant?.phone).map((bed) => (
                        <a key={bed.id} href={`tel:${bed.tenant?.phone}`} className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-secondary transition-colors">
                          <div>
                            <p className="text-sm font-medium">{bed.tenant?.full_name}</p>
                            <p className="text-xs text-muted-foreground">{bed.tenant?.phone}</p>
                          </div>
                          <Phone className="w-4 h-4 text-primary" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Per-Bed Payment Section */}
                {selectedRoom.beds.some((b) => b.status === 'occupied' && b.tenant_id) && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <IndianRupee className="w-4 h-4 text-emerald-600" />
                      Record Payment
                    </h4>
                    <div className="space-y-3">
                      {selectedRoom.beds.filter((b) => b.status === 'occupied' && b.tenant_id).map((bed) => {
                        const pay = bedPayments[bed.id] ?? { amount: '', method: 'cash' };
                        const isRecording = recordingBed === bed.id;
                        return (
                          <div key={bed.id} className="rounded-2xl border border-border bg-card p-3.5 space-y-3">
                            {/* Tenant info */}
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0 ${bedDotStyle(bed, 0)}`}>
                                {bed.bed_label.slice(-1)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold truncate">{bed.tenant?.full_name ?? 'Tenant'}</p>
                                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                  <span className="text-[11px] text-muted-foreground">{bed.bed_label} · ₹{Number(bed.tenant?.monthly_rent ?? selectedRoom.monthly_rent).toLocaleString('en-IN')}/mo</span>
                                  {(bed.due ?? 0) > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => setBedPayments(prev => ({ ...prev, [bed.id]: { ...pay, amount: String(bed.due) } }))}
                                      className="text-[10px] font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 px-1.5 py-0.5 rounded border border-red-500/20 transition-colors cursor-pointer"
                                      title="Click to fill due amount"
                                    >
                                      Due: ₹{(bed.due ?? 0).toLocaleString('en-IN')} ⚡
                                    </button>
                                  ) : (
                                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                      ✅ All Clear
                                    </span>
                                  )}
                                </div>
                              </div>
                              {bed.tenant?.phone && (
                                <a href={`tel:${bed.tenant.phone}`} className="shrink-0 w-8 h-8 rounded-lg bg-secondary hover:bg-muted flex items-center justify-center transition-colors">
                                  <Phone className="w-3.5 h-3.5 text-primary" />
                                </a>
                              )}
                            </div>

                            {/* Payment method toggle */}
                            <div className="flex gap-1.5">
                              {['cash', 'upi', 'bank_transfer', 'cheque'].map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => setBedPayments(prev => ({ ...prev, [bed.id]: { ...pay, method: m } }))}
                                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold capitalize border transition-all ${
                                    pay.method === m
                                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                      : 'bg-secondary text-muted-foreground border-border hover:bg-muted'
                                  }`}
                                >
                                  {m === 'bank_transfer' ? 'Bank' : m.toUpperCase()}
                                </button>
                              ))}
                            </div>

                            {/* Amount + Record */}
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <IndianRupee className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                  type="number"
                                  placeholder={bed.due && bed.due > 0 ? `Due: ₹${bed.due.toLocaleString('en-IN')}` : `Rent: ₹${Number(bed.tenant?.monthly_rent ?? selectedRoom.monthly_rent).toLocaleString('en-IN')}`}
                                  value={pay.amount}
                                  onChange={(e) => setBedPayments(prev => ({ ...prev, [bed.id]: { ...pay, amount: e.target.value } }))}
                                  className="pl-7 h-9 text-sm rounded-xl font-semibold"
                                />
                              </div>
                              <Button
                                size="sm"
                                className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                disabled={!pay.amount || isRecording}
                                onClick={() => bed.tenant_id && handleRecordBedPayment(bed.id, bed.tenant_id)}
                              >
                                {isRecording ? '...' : 'Record'}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Edit Room Settings */}
                <div className="p-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <IndianRupee className="w-4 h-4 text-primary" />
                    Room Settings
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Monthly Rent (₹)</label>
                      <div className="relative">
                        <IndianRupee className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="number"
                          value={editRent}
                          onChange={(e) => setEditRent(e.target.value)}
                          className="pl-7 h-9 text-sm rounded-lg font-semibold"
                          placeholder="6500"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Bed Capacity</label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditCapacity(Math.max(1, editCapacity - 1))}
                          className="w-9 h-9 rounded-lg border border-border bg-secondary hover:bg-muted flex items-center justify-center font-bold transition-colors text-base"
                        >
                          −
                        </button>
                        <Input
                          type="number"
                          min="1"
                          max="10"
                          value={editCapacity}
                          onChange={(e) => setEditCapacity(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                          className="h-9 text-sm rounded-lg font-bold text-center flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => setEditCapacity(Math.min(10, editCapacity + 1))}
                          className="w-9 h-9 rounded-lg border border-border bg-secondary hover:bg-muted flex items-center justify-center font-bold transition-colors text-base"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full rounded-xl h-9 shadow-md shadow-primary/20"
                    onClick={handleSaveRoomSettings}
                    disabled={editSaving}
                  >
                    {editSaving ? 'Saving...' : 'Save Room Settings'}
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center">Capacity changes add or remove vacant beds. Occupied or maintenance beds cannot be removed.</p>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => handleMarkMaintenance(selectedRoom.id)}>
                    <Wrench className="w-4 h-4 text-amber-500" />Mark for Maintenance
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => toast({ title: 'KYC Upload', description: 'Go to tenant profile to upload KYC' })}>
                    <Camera className="w-4 h-4" />Upload KYC Document
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Add Room Dialog */}
      <AddRoomDialog
        open={addRoomOpen}
        onOpenChange={setAddRoomOpen}
        hostelId={hostelId}
        floors={floors}
        onSuccess={() => {
          if (hostelId) void loadData(hostelId);
        }}
        onOpenAddFloor={() => setAddFloorOpen(true)}
      />

      {/* Add Floor Dialog */}
      <AddFloorDialog
        open={addFloorOpen}
        onOpenChange={setAddFloorOpen}
        hostelId={hostelId}
        existingFloors={floors}
        onSuccess={() => {
          if (hostelId) void loadData(hostelId);
        }}
      />

      {/* Add Tenant Dialog — opened by clicking a vacant bed */}
      <OnboardTenantDialog
        open={tenantDialogOpen}
        onOpenChange={(o) => {
          setTenantDialogOpen(o);
          if (!o) { setTenantDialogBedId(undefined); setTenantDialogRoomId(undefined); }
        }}
        hostelId={hostelId}
        userId={profile?.id}
        preselectedRoomId={tenantDialogRoomId}
        preselectedBedId={tenantDialogBedId}
        onSuccess={() => {
          setSheetOpen(false);
          if (hostelId) void loadData(hostelId);
        }}
      />
    </div>
  );
}
