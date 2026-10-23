'use client';

import React, { useState, useMemo } from 'react';
import { useAdmin } from '@/lib/admin-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  Users,
  Search,
  PhoneCall,
  ShieldCheck,
  ShieldAlert,
  Building2,
  Calendar,
  Phone,
  Mail,
  UserCheck,
  PauseCircle,
  PlayCircle,
  CheckCircle2,
} from 'lucide-react';
import type { Tenant } from '@/lib/types';

export default function AdminTenantsPage() {
  const { tenants, hostels, toggleTenantAiCalls } = useAdmin();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterHostel, setFilterHostel] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [detailTenant, setDetailTenant] = useState<Tenant | null>(null);

  // Filtered tenants
  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      const hostel = hostels.find((h) => h.id === t.hostel_id);
      const matchesSearch =
        t.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.email && t.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (hostel && hostel.name.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesHostel = filterHostel === 'all' || t.hostel_id === filterHostel;
      const matchesStatus = filterStatus === 'all' || t.status === filterStatus;

      return matchesSearch && matchesHostel && matchesStatus;
    });
  }, [tenants, hostels, searchTerm, filterHostel, filterStatus]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-indigo-400" />
            Global Tenants & KYC Directory
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Complete tenant roster across all properties, KYC document verification, and AI reminder management.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-2 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, email, or hostel..."
            className="pl-9 bg-background border-border text-foreground text-xs h-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div>
          <Select value={filterHostel} onValueChange={setFilterHostel}>
            <SelectTrigger className="bg-card border-border text-xs text-foreground h-9">
              <SelectValue placeholder="All Hostels" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground/90">
              <SelectItem value="all">🌐 All Hostels</SelectItem>
              {hostels.map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  🏨 {h.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="bg-card border-border text-xs text-foreground h-9">
              <SelectValue placeholder="Lease Status" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground/90">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active Residents</SelectItem>
              <SelectItem value="on_leave">On Leave</SelectItem>
              <SelectItem value="inactive">Checked Out</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tenants Table */}
      <Card className="bg-card/90 border-border shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-background/70 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
              <tr>
                <th className="py-3 px-4">Tenant Name</th>
                <th className="py-3 px-4">Hostel Property</th>
                <th className="py-3 px-4">Monthly Rent</th>
                <th className="py-3 px-4">KYC ID Proof</th>
                <th className="py-3 px-4">AI Reminder Calls</th>
                <th className="py-3 px-4">Lease Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground/70 text-sm">
                    No tenants found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((tenant) => {
                  const hostel = hostels.find((h) => h.id === tenant.hostel_id);

                  return (
                    <tr key={tenant.id} className="hover:bg-secondary/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-foreground text-xs">{tenant.full_name}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <Phone className="h-3 w-3 text-muted-foreground/70" />
                          <span>{tenant.phone}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-xs text-indigo-300 font-medium">
                          {hostel?.name || 'Assigned Property'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-foreground text-xs">
                          ₹{tenant.monthly_rent.toLocaleString('en-IN')}/mo
                        </div>
                        <div className="text-[10px] text-muted-foreground/70">Due {tenant.rent_due_day}th</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          variant="outline"
                          className="border-border text-foreground/80 text-[10px] uppercase font-mono"
                        >
                          <ShieldCheck className="h-3 w-3 mr-1 text-emerald-400" />
                          {tenant.id_proof_type || 'Aadhaar'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4">
                        {tenant.pause_ai_calls ? (
                          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] flex items-center gap-1 w-fit">
                            <PauseCircle className="h-3 w-3" />
                            Paused
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] flex items-center gap-1 w-fit">
                            <PlayCircle className="h-3 w-3" />
                            Active
                          </Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          className={`text-[10px] capitalize ${
                            tenant.status === 'active'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : tenant.status === 'on_leave'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-secondary text-muted-foreground'
                          }`}
                        >
                          {tenant.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-secondary"
                            onClick={() => setDetailTenant(tenant)}
                          >
                            Details
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[11px] border-border bg-card text-foreground/80 hover:text-foreground"
                            onClick={() => toggleTenantAiCalls(tenant.id, !tenant.pause_ai_calls)}
                          >
                            {tenant.pause_ai_calls ? 'Enable AI' : 'Pause AI'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ================= MODAL: TENANT DETAILS ================= */}
      <Dialog open={Boolean(detailTenant)} onOpenChange={(open) => !open && setDetailTenant(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-400" />
              {detailTenant?.full_name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Tenant Profile & Verification Details
            </DialogDescription>
          </DialogHeader>

          {detailTenant && (
            <div className="space-y-4 pt-2 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-background rounded-lg border border-border">
                <div>
                  <span className="text-muted-foreground/70 uppercase text-[10px] block">Contact Number</span>
                  <span className="font-semibold text-foreground">{detailTenant.phone}</span>
                </div>
                <div>
                  <span className="text-muted-foreground/70 uppercase text-[10px] block">Email Address</span>
                  <span className="font-semibold text-foreground">{detailTenant.email || 'None provided'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground/70 uppercase text-[10px] block">Monthly Rent</span>
                  <span className="font-bold text-emerald-400">
                    ₹{detailTenant.monthly_rent.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground/70 uppercase text-[10px] block">Security Deposit</span>
                  <span className="font-bold text-foreground/90">
                    ₹{(detailTenant.security_deposit || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-background rounded-lg border border-border space-y-2">
                <span className="text-muted-foreground font-semibold block">Emergency Contact</span>
                <div className="flex justify-between">
                  <span className="text-muted-foreground/70">Contact Name:</span>
                  <span className="text-foreground">{detailTenant.emergency_contact_name || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground/70">Contact Phone:</span>
                  <span className="text-foreground">{detailTenant.emergency_contact_phone || 'N/A'}</span>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-indigo-700/60 text-indigo-300"
                  onClick={() => {
                    toggleTenantAiCalls(detailTenant.id, !detailTenant.pause_ai_calls);
                    setDetailTenant((prev) => (prev ? { ...prev, pause_ai_calls: !prev.pause_ai_calls } : null));
                  }}
                >
                  <PhoneCall className="h-3.5 w-3.5 mr-1" />
                  {detailTenant.pause_ai_calls ? 'Enable Voice Reminders' : 'Pause Voice Reminders'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDetailTenant(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
