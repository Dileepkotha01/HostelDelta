'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/lib/admin-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Building2,
  PlusCircle,
  Search,
  MapPin,
  Pencil,
  Trash2,
  BedDouble,
  Users,
  TrendingUp,
  Layers,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import type { AdminHostelOverview } from '@/lib/types';
import { getPortalUrl } from '@/lib/portal-urls';

export default function AdminHostelsPage() {
  const router = useRouter();
  const {
    hostelOverviews,
    createHostel,
    updateHostel,
    deleteHostel,
    setSelectedHostelId,
    selectedHostelId,
    rooms,
    beds,
    tenants,
  } = useAdmin();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('all');

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [targetHostel, setTargetHostel] = useState<AdminHostelOverview | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formState, setFormState] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formFloors, setFormFloors] = useState('3');
  const [formRooms, setFormRooms] = useState('12');
  const [formBillingDay, setFormBillingDay] = useState('5');
  const [submitting, setSubmitting] = useState(false);

  // Cities list for filter
  const cities = Array.from(
    new Set(hostelOverviews.map((h) => h.city).filter(Boolean) as string[])
  );

  // Filtered hostels
  const filtered = hostelOverviews.filter((h) => {
    const matchesSearch =
      h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (h.city && h.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (h.owner_name && h.owner_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCity = selectedCity === 'all' || h.city === selectedCity;
    return matchesSearch && matchesCity;
  });

  const openCreate = () => {
    setFormName('');
    setFormCity('');
    setFormState('');
    setFormAddress('');
    setFormFloors('3');
    setFormRooms('12');
    setFormBillingDay('5');
    setCreateOpen(true);
  };

  const openEdit = (hostel: AdminHostelOverview) => {
    setTargetHostel(hostel);
    setFormName(hostel.name);
    setFormCity(hostel.city || '');
    setFormState(hostel.state || '');
    setFormAddress(hostel.address || '');
    setFormFloors(String(hostel.total_floors || 1));
    setFormRooms(String(hostel.total_rooms || 1));
    setFormBillingDay(String(hostel.billing_day || 1));
    setEditOpen(true);
  };

  const openInspect = (hostel: AdminHostelOverview) => {
    setTargetHostel(hostel);
    setInspectOpen(true);
  };

  const openDelete = (hostel: AdminHostelOverview) => {
    setTargetHostel(hostel);
    setDeleteOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    setSubmitting(true);
    await createHostel({
      name: formName.trim(),
      city: formCity.trim(),
      state: formState.trim(),
      address: formAddress.trim(),
      total_floors: parseInt(formFloors, 10) || 1,
      total_rooms: parseInt(formRooms, 10) || 1,
      billing_day: parseInt(formBillingDay, 10) || 1,
      currency: 'INR',
    });
    setSubmitting(false);
    setCreateOpen(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetHostel || !formName.trim()) return;

    setSubmitting(true);
    await updateHostel(targetHostel.id, {
      name: formName.trim(),
      city: formCity.trim(),
      state: formState.trim(),
      address: formAddress.trim(),
      total_floors: parseInt(formFloors, 10) || 1,
      total_rooms: parseInt(formRooms, 10) || 1,
      billing_day: parseInt(formBillingDay, 10) || 1,
    });
    setSubmitting(false);
    setEditOpen(false);
  };

  const handleDeleteSubmit = async () => {
    if (!targetHostel) return;
    setSubmitting(true);
    await deleteHostel(targetHostel.id);
    setSubmitting(false);
    setDeleteOpen(false);
  };

  // Inspect details
  const targetRooms = targetHostel ? rooms.filter((r) => r.hostel_id === targetHostel.id) : [];
  const targetTenants = targetHostel ? tenants.filter((t) => t.hostel_id === targetHostel.id) : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-indigo-400" />
            Hostels Directory & Management
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Full operational control over every hostel, structure, inventory, and linked ownership.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-indigo-600 hover:bg-indigo-500 text-foreground font-medium text-xs h-9 flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Add New Hostel</span>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search hostels by name, city, or owner..."
            className="pl-9 bg-background border-border text-foreground text-xs h-9 w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {cities.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <Button
              variant={selectedCity === 'all' ? 'default' : 'outline'}
              size="sm"
              className={`h-8 text-xs ${
                selectedCity === 'all'
                  ? 'bg-indigo-600 text-foreground'
                  : 'bg-card border-border text-foreground/80'
              }`}
              onClick={() => setSelectedCity('all')}
            >
              All Cities ({hostelOverviews.length})
            </Button>
            {cities.map((city) => (
              <Button
                key={city}
                variant={selectedCity === city ? 'default' : 'outline'}
                size="sm"
                className={`h-8 text-xs ${
                  selectedCity === city
                    ? 'bg-indigo-600 text-foreground'
                    : 'bg-card border-border text-foreground/80'
                }`}
                onClick={() => setSelectedCity(city)}
              >
                {city}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Hostels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((hostel) => {
          const isScoped = selectedHostelId === hostel.id;

          return (
            <Card
              key={hostel.id}
              className={`bg-card/90 border transition-all hover:border-border shadow-lg flex flex-col justify-between ${
                isScoped ? 'border-indigo-500/80 ring-1 ring-indigo-500/40' : 'border-border'
              }`}
            >
              <CardHeader className="pb-3 border-b border-border/80">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-bold text-foreground hover:text-indigo-400 transition-colors">
                      {hostel.name}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                      <span>{hostel.city ? `${hostel.city}, ${hostel.state || 'India'}` : 'Location unconfigured'}</span>
                    </p>
                  </div>
                  {isScoped ? (
                    <Badge className="bg-indigo-600 text-foreground text-[10px] h-5">
                      Active Scope
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-border text-muted-foreground text-[10px] h-5">
                      Property #{hostel.id.slice(0, 5)}
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-4 space-y-3.5 flex-1">
                {/* Metrics Matrix */}
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-background/60 border border-border/80 text-center">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground/70 font-semibold">Rooms</div>
                    <div className="text-sm font-bold text-foreground/90">{hostel.rooms_count}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground/70 font-semibold">Beds</div>
                    <div className="text-sm font-bold text-foreground/90">{hostel.beds_count}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground/70 font-semibold">Tenants</div>
                    <div className="text-sm font-bold text-indigo-400">{hostel.active_tenants_count}</div>
                  </div>
                </div>

                {/* Occupancy Progress */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Bed Occupancy</span>
                    <span className="font-bold text-foreground">{hostel.occupancy_rate}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full rounded-full transition-all"
                      style={{ width: `${hostel.occupancy_rate}%` }}
                    />
                  </div>
                </div>

                {/* Revenue & Receivables */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-border/60">
                  <span className="text-muted-foreground">Collected:</span>
                  <span className="font-bold text-emerald-400">
                    ₹{(hostel.total_revenue || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Pending Rent:</span>
                  <span className="font-semibold text-amber-400">
                    ₹{(hostel.pending_revenue || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </CardContent>

              {/* Card Footer Actions */}
              <div className="p-3 border-t border-border/80 bg-background/40 flex items-center justify-between gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-indigo-400 hover:text-foreground hover:bg-indigo-600/30"
                  onClick={() => openInspect(hostel)}
                >
                  Inspect
                </Button>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary"
                    onClick={() => openEdit(hostel)}
                    title="Edit Hostel Details"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                    onClick={() => openDelete(hostel)}
                    title="Delete Hostel"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    size="sm"
                    className={`h-8 text-xs font-semibold px-2.5 ${
                      isScoped
                        ? 'bg-secondary text-foreground/80 hover:bg-slate-700'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-foreground'
                    }`}
                    onClick={() => {
                      setSelectedHostelId(hostel.id);
                    }}
                  >
                    {isScoped ? 'Selected' : 'Scope In'}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="py-16 text-center text-muted-foreground">
          <Building2 className="h-10 w-10 text-slate-600 mx-auto mb-2" />
          <p className="font-medium text-foreground">No hostels found matching your filter</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Try searching a different city or name.</p>
        </div>
      )}

      {/* ================= MODAL: CREATE HOSTEL ================= */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Register New Property</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Create a new hostel entity in the database.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs text-foreground/80">Hostel Name *</Label>
              <Input
                required
                placeholder="e.g. Green Valley PG"
                className="bg-background border-border text-sm mt-1"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-foreground/80">Street Address</Label>
              <Input
                placeholder="e.g. 14th Cross, HSR Layout"
                className="bg-background border-border text-sm mt-1"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-foreground/80">City</Label>
                <Input
                  placeholder="e.g. Bengaluru"
                  className="bg-background border-border text-sm mt-1"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-foreground/80">State</Label>
                <Input
                  placeholder="e.g. Karnataka"
                  className="bg-background border-border text-sm mt-1"
                  value={formState}
                  onChange={(e) => setFormState(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-foreground/80">Floors</Label>
                <Input
                  type="number"
                  min="1"
                  className="bg-background border-border text-sm mt-1"
                  value={formFloors}
                  onChange={(e) => setFormFloors(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-foreground/80">Rooms</Label>
                <Input
                  type="number"
                  min="1"
                  className="bg-background border-border text-sm mt-1"
                  value={formRooms}
                  onChange={(e) => setFormRooms(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-foreground/80">Rent Day</Label>
                <Input
                  type="number"
                  min="1"
                  max="28"
                  className="bg-background border-border text-sm mt-1"
                  value={formBillingDay}
                  onChange={(e) => setFormBillingDay(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter className="pt-3">
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-500 text-xs">
                {submitting ? 'Creating...' : 'Create Property'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: EDIT HOSTEL ================= */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Edit Hostel Details</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update property specifications in database.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs text-foreground/80">Hostel Name *</Label>
              <Input
                required
                className="bg-background border-border text-sm mt-1"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-foreground/80">Street Address</Label>
              <Input
                className="bg-background border-border text-sm mt-1"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-foreground/80">City</Label>
                <Input
                  className="bg-background border-border text-sm mt-1"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-foreground/80">State</Label>
                <Input
                  className="bg-background border-border text-sm mt-1"
                  value={formState}
                  onChange={(e) => setFormState(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-foreground/80">Floors</Label>
                <Input
                  type="number"
                  className="bg-background border-border text-sm mt-1"
                  value={formFloors}
                  onChange={(e) => setFormFloors(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-foreground/80">Rooms</Label>
                <Input
                  type="number"
                  className="bg-background border-border text-sm mt-1"
                  value={formRooms}
                  onChange={(e) => setFormRooms(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-foreground/80">Rent Day</Label>
                <Input
                  type="number"
                  min="1"
                  max="28"
                  className="bg-background border-border text-sm mt-1"
                  value={formBillingDay}
                  onChange={(e) => setFormBillingDay(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter className="pt-3">
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-500 text-xs">
                {submitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: INSPECT HOSTEL ================= */}
      <Dialog open={inspectOpen} onOpenChange={setInspectOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-400" />
              {targetHostel?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Live Property Structure & Active Tenants Overview
            </DialogDescription>
          </DialogHeader>

          {targetHostel && (
            <div className="space-y-6 pt-3">
              {/* Info pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-background rounded-lg border border-border">
                  <div className="text-[10px] text-muted-foreground uppercase">Total Rooms</div>
                  <div className="text-lg font-bold text-foreground">{targetRooms.length}</div>
                </div>
                <div className="p-3 bg-background rounded-lg border border-border">
                  <div className="text-[10px] text-muted-foreground uppercase">Active Tenants</div>
                  <div className="text-lg font-bold text-indigo-400">{targetTenants.length}</div>
                </div>
                <div className="p-3 bg-background rounded-lg border border-border">
                  <div className="text-[10px] text-muted-foreground uppercase">Occupancy</div>
                  <div className="text-lg font-bold text-emerald-400">{targetHostel.occupancy_rate}%</div>
                </div>
                <div className="p-3 bg-background rounded-lg border border-border">
                  <div className="text-[10px] text-muted-foreground uppercase">Rent Due Day</div>
                  <div className="text-lg font-bold text-amber-400">{targetHostel.billing_day}th</div>
                </div>
              </div>

              {/* Rooms Roster */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <BedDouble className="h-4 w-4 text-indigo-400" />
                  Rooms & Inventory ({targetRooms.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-1">
                  {targetRooms.map((room) => (
                    <div
                      key={room.id}
                      className="p-2.5 rounded-lg bg-background/80 border border-border text-xs"
                    >
                      <div className="flex items-center justify-between font-bold text-foreground">
                        <span>Room {room.room_number}</span>
                        <Badge
                          className={`text-[9px] h-4 ${
                            room.status === 'occupied'
                              ? 'bg-indigo-500/20 text-indigo-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {room.status}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1 capitalize">
                        {room.room_type} • ₹{room.monthly_rent}/mo
                      </div>
                    </div>
                  ))}
                  {targetRooms.length === 0 && (
                    <div className="col-span-4 text-center py-4 text-muted-foreground/70 text-xs">
                      No rooms added to this hostel yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Active Tenants List */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-indigo-400" />
                  Resident Tenants ({targetTenants.length})
                </h3>
                <div className="divide-y divide-border/80 max-h-48 overflow-y-auto border border-border rounded-lg">
                  {targetTenants.map((t) => (
                    <div key={t.id} className="p-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-foreground">{t.full_name}</div>
                        <div className="text-[11px] text-muted-foreground">{t.phone}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-emerald-400 font-semibold">₹{t.monthly_rent}/mo</div>
                        <div className="text-[10px] text-muted-foreground/70 uppercase">{t.status}</div>
                      </div>
                    </div>
                  ))}
                  {targetTenants.length === 0 && (
                    <div className="p-4 text-center text-muted-foreground/70 text-xs">
                      No resident tenants currently assigned.
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-between">
                <Button
                  variant="outline"
                  className="text-xs border-indigo-700/60 text-indigo-300"
                  onClick={() => {
                    setSelectedHostelId(targetHostel.id);
                    window.location.assign(getPortalUrl('app', '/app/dashboard'));
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  Open in Single-Hostel Manager
                </Button>
                <Button variant="ghost" onClick={() => setInspectOpen(false)} className="text-xs">
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: DELETE HOSTEL CONFIRM ================= */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-400">
              Delete Hostel?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to permanently delete{' '}
              <strong className="text-foreground">{targetHostel?.name}</strong>? This action cannot be
              undone and will remove all linked rooms, beds, and tenant data.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3">
            <Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              type="button"
              disabled={submitting}
              className="bg-rose-600 hover:bg-rose-500 text-foreground text-xs font-semibold"
              onClick={handleDeleteSubmit}
            >
              {submitting ? 'Deleting...' : 'Confirm Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
