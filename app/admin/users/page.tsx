'use client';

import React, { useState } from 'react';
import { useAdmin } from '@/lib/admin-context';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  ShieldCheck,
  Search,
  UserCheck,
  ShieldAlert,
  Users,
  Building2,
  Crown,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import type { Profile, UserRole } from '@/lib/types';

export default function AdminUsersPage() {
  const { profiles, updateUserRole, hostels } = useAdmin();
  const { profile: currentProfile } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Edit role modal
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [targetRole, setTargetRole] = useState<UserRole>('hostel_owner');
  const [submitting, setSubmitting] = useState(false);

  // Filtered profiles
  const filteredProfiles = profiles.filter((p) => {
    const matchesSearch =
      (p.full_name && p.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.email && p.email.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRole = roleFilter === 'all' || p.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;

    setSubmitting(true);
    const { error } = await updateUserRole(editUser.id, targetRole);
    setSubmitting(false);
    if (error) return;
    setEditUser(null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-indigo-400" />
            User Accounts & Role Permissions
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Manage hostel owners, caretakers, platform super administrators, and tenant accounts.
          </p>
        </div>
      </div>

      {/* Current User Super Admin Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-card border border-indigo-800/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-foreground shrink-0 shadow-md">
            <Crown className="h-5 w-5 text-amber-300" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground flex items-center gap-2">
              <span>Your Active Session: {currentProfile?.full_name || 'Admin'}</span>
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">
                Platform Owner
              </Badge>
            </div>
            <p className="text-xs text-indigo-200/80">
              Logged in as {currentProfile?.email}. You have full operational control over all database resources.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 text-xs px-2.5 py-1">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Full DB Privileges
          </Badge>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by full name or email address..."
            className="pl-9 bg-background border-border text-foreground text-xs h-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="bg-card border-border text-xs text-foreground h-9">
              <SelectValue placeholder="Filter by Role" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground/90">
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="super_admin">Super Admins</SelectItem>
              <SelectItem value="hostel_owner">Hostel Owners</SelectItem>
              <SelectItem value="caretaker">Caretakers / Staff</SelectItem>
              <SelectItem value="tenant">Tenants</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Users Table */}
      <Card className="bg-card/90 border-border shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-background/70 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
              <tr>
                <th className="py-3 px-4">User Details</th>
                <th className="py-3 px-4">Role Permission</th>
                <th className="py-3 px-4">Linked Hostel</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4">Joined Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground/70 text-sm">
                    No accounts found matching your query.
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((p) => {
                  const linkedHostel = hostels.find((h) => h.id === p.hostel_id);
                  const isCurrent = p.id === currentProfile?.id;

                  return (
                    <tr key={p.id} className="hover:bg-secondary/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                          <span>{p.full_name || 'Unnamed Account'}</span>
                          {isCurrent && (
                            <Badge className="bg-indigo-500/20 text-indigo-300 text-[9px] h-4">
                              You
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{p.email}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          className={`text-[10px] capitalize ${
                            p.role === 'super_admin'
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                              : p.role === 'hostel_owner'
                              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                              : p.role === 'caretaker'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-secondary text-foreground/80 border-border'
                          }`}
                        >
                          {p.role.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-foreground/80">
                        {linkedHostel?.name || 'All Properties'}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            p.active !== false
                              ? 'border-emerald-500/40 text-emerald-300'
                              : 'border-rose-500/40 text-rose-300'
                          }`}
                        >
                          {p.active !== false ? 'Active' : 'Suspended'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-muted-foreground">
                        {p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN') : 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-secondary"
                          onClick={() => {
                            setEditUser(p);
                            setTargetRole(p.role);
                          }}
                        >
                          Edit Role
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ================= MODAL: EDIT USER ROLE ================= */}
      <Dialog open={Boolean(editUser)} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-indigo-400" />
              Change Role Permissions
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update role assignment for <strong className="text-foreground">{editUser?.full_name}</strong>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRoleSubmit} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs text-foreground/80">Select Role</Label>
              <Select value={targetRole} onValueChange={(val) => setTargetRole(val as UserRole)}>
                <SelectTrigger className="bg-background border-border text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground/90">
                  <SelectItem value="super_admin">Super Admin (Full Platform Access)</SelectItem>
                  <SelectItem value="hostel_owner">Hostel Owner (Property Manager)</SelectItem>
                  <SelectItem value="caretaker">Caretaker / Operations Staff</SelectItem>
                  <SelectItem value="tenant">Resident Tenant</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditUser(null)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-500 text-xs">
                {submitting ? 'Updating...' : 'Update Role'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
