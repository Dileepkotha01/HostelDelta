'use client';

import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useHostelScope } from '@/hooks/use-hostel-scope';
import { NoHostelLinked } from '@/components/no-hostel-linked';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { IndianMobileInput } from '@/components/ui/indian-mobile-input';
import { isValidIndianMobileNumber, toIndianMobileE164 } from '@/lib/indian-mobile';
import { OwnerBankSetup } from '@/components/OwnerBankSetup';
import { useTheme } from '@/lib/theme-provider';
import {
  Settings,
  Building2,
  User,
  Shield,
  Bell,
  Palette,
  Save,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  Sun,
  Moon,
  Loader2,
  AlertCircle,
  Key,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { Hostel } from '@/lib/types';

export default function SettingsPage() {
  const { profile, signOut } = useAuth();
  const { hostelId, isReady, hasHostel } = useHostelScope();
  const { toast } = useToast();
  const { theme, toggle } = useTheme();

  const [hostel, setHostel] = useState<Hostel | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Hostel form
  const [hostelName, setHostelName] = useState('');
  const [hostelAddress, setHostelAddress] = useState('');
  const [hostelCity, setHostelCity] = useState('');
  const [hostelState, setHostelState] = useState('');
  const [billingDay, setBillingDay] = useState('5');
  const [currency, setCurrency] = useState('INR');

  // Profile form
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!isReady || !hostelId) {
      setLoading(false);
      return;
    }
    loadData(hostelId);
  }, [isReady, hostelId]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  async function loadData(hid: string) {
    setLoading(true);
    const { data } = await supabase.from('hostels').select('*').eq('id', hid).maybeSingle();
    if (data) {
      setHostel(data as Hostel);
      setHostelName(data.name || '');
      setHostelAddress(data.address || '');
      setHostelCity(data.city || '');
      setHostelState(data.state || '');
      setBillingDay(String(data.billing_day || 5));
      setCurrency(data.currency || 'INR');
    }
    setLoading(false);
  }

  async function saveHostelSettings(e: FormEvent) {
    e.preventDefault();
    if (!hostelId) return;
    setSaving(true);
    const { error } = await supabase.from('hostels').update({
      name: hostelName,
      address: hostelAddress,
      city: hostelCity,
      state: hostelState,
      billing_day: parseInt(billingDay),
      currency,
    }).eq('id', hostelId);

    if (error) {
      toast({ title: 'Failed to save', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Hostel settings saved!', description: 'Your changes have been applied.' });
      loadData(hostelId);
    }
    setSaving(false);
  }

  async function saveProfileSettings(e: FormEvent) {
    e.preventDefault();
    if (!profile?.id) return;
    if (phone && !isValidIndianMobileNumber(phone)) {
      toast({ title: 'Enter a valid 10-digit Indian mobile number', description: 'The +91 country code is already selected.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      full_name: fullName,
      phone: phone ? toIndianMobileE164(phone) : '',
    }).eq('id', profile.id);

    if (error) {
      toast({ title: 'Failed to update profile', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Profile updated!', description: 'Your profile information has been saved.' });
    }
    setSaving(false);
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: 'Password must be at least 8 characters', variant: 'destructive' });
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: 'Failed to change password', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Password changed!', description: 'Your new password is active.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    setChangingPassword(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-muted-foreground animate-pulse">
          <Settings className="w-8 h-8 opacity-50" />
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  if (isReady && !hasHostel) return <NoHostelLinked />;

  return (
    <div className="space-y-8 pb-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl lg:text-4xl font-black tracking-tight flex items-center gap-3">
          <Settings className="w-8 h-8 text-primary" /> Settings
        </h1>
        <p className="text-muted-foreground mt-2 font-medium">
          Manage your hostel, profile, and account preferences.
        </p>
      </div>

      <Tabs defaultValue="hostel" className="w-full">
        <TabsList className="h-11 bg-secondary/50 p-1 rounded-xl mb-6">
          <TabsTrigger value="hostel" className="rounded-lg gap-2">
            <Building2 className="w-4 h-4" /> Hostel
          </TabsTrigger>
          <TabsTrigger value="payments" className="rounded-lg gap-2">
            <CreditCard className="w-4 h-4" /> Payments
          </TabsTrigger>
          <TabsTrigger value="profile" className="rounded-lg gap-2">
            <User className="w-4 h-4" /> Profile
          </TabsTrigger>
          <TabsTrigger value="appearance" className="rounded-lg gap-2">
            <Palette className="w-4 h-4" /> Appearance
          </TabsTrigger>
          <TabsTrigger value="security" className="rounded-lg gap-2">
            <Shield className="w-4 h-4" /> Security
          </TabsTrigger>
        </TabsList>

        {/* ── Hostel Settings ── */}
        <TabsContent value="hostel">
          <form onSubmit={saveHostelSettings} className="space-y-6">
            <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-border">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Hostel Information</h2>
                  <p className="text-sm text-muted-foreground">Basic details about your property</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="hostel-name">Hostel Name *</Label>
                  <Input
                    id="hostel-name"
                    value={hostelName}
                    onChange={(e) => setHostelName(e.target.value)}
                    required
                    placeholder="e.g. Sunrise Men's Hostel"
                    className="bg-secondary/30 font-medium"
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="hostel-address" className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5" /> Address
                  </Label>
                  <Input
                    id="hostel-address"
                    value={hostelAddress}
                    onChange={(e) => setHostelAddress(e.target.value)}
                    placeholder="Street address"
                    className="bg-secondary/30"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hostel-city">City</Label>
                  <Input
                    id="hostel-city"
                    value={hostelCity}
                    onChange={(e) => setHostelCity(e.target.value)}
                    placeholder="e.g. Bengaluru"
                    className="bg-secondary/30"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hostel-state">State</Label>
                  <Input
                    id="hostel-state"
                    value={hostelState}
                    onChange={(e) => setHostelState(e.target.value)}
                    placeholder="e.g. Karnataka"
                    className="bg-secondary/30"
                  />
                </div>
              </div>

              <div className="border-t border-border pt-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" /> Billing Configuration
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="billing-day" className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5" /> Billing Day of Month
                    </Label>
                    <Select value={billingDay} onValueChange={setBillingDay}>
                      <SelectTrigger className="bg-secondary/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                          <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Invoices are generated on this day each month</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger className="bg-secondary/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INR">₹ INR — Indian Rupee</SelectItem>
                        <SelectItem value="USD">$ USD — US Dollar</SelectItem>
                        <SelectItem value="GBP">£ GBP — British Pound</SelectItem>
                        <SelectItem value="AED">AED — UAE Dirham</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Hostel Stats Info */}
              {hostel && (
                <div className="border-t border-border pt-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Floors', value: hostel.total_floors },
                      { label: 'Total Rooms', value: hostel.total_rooms },
                      { label: 'Currency', value: hostel.currency },
                      { label: 'Billing Day', value: `Day ${hostel.billing_day}` },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-secondary/30 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold">{value}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving} className="shadow-lg shadow-primary/20 px-8">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {saving ? 'Saving...' : 'Save Hostel Settings'}
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* ── Payments Setup ── */}
        <TabsContent value="payments">
          <OwnerBankSetup hostelId={hostelId!} />
        </TabsContent>

        {/* ── Profile Settings ── */}
        <TabsContent value="profile">
          <form onSubmit={saveProfileSettings} className="space-y-6">
            <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-border">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                  {profile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
                </div>
                <div>
                  <h2 className="font-bold text-lg">{profile?.full_name}</h2>
                  <Badge variant="outline" className="capitalize text-xs mt-1">
                    {profile?.role?.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="profile-name" className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5" /> Full Name *
                  </Label>
                  <Input
                    id="profile-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="bg-secondary/30"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profile-phone" className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5" /> Phone Number
                  </Label>
                  <IndianMobileInput
                    id="profile-phone"
                    value={phone}
                    onChange={setPhone}
                    className="bg-secondary/30"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5" /> Email Address
                  </Label>
                  <Input
                    value={profile?.email || ''}
                    disabled
                    className="bg-secondary/10 text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground">Email cannot be changed. Contact support if needed.</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving} className="shadow-lg shadow-primary/20 px-8">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {saving ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* ── Appearance ── */}
        <TabsContent value="appearance">
          <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-border">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Palette className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Appearance</h2>
                <p className="text-sm text-muted-foreground">Customize how HostelHub looks for you</p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Theme</h3>
              <div className="grid grid-cols-2 gap-4 max-w-sm">
                <button
                  onClick={() => theme === 'dark' && toggle()}
                  className={`relative flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all ${
                    theme === 'light'
                      ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                    <Sun className="w-6 h-6 text-amber-500" />
                  </div>
                  <span className="font-semibold text-sm">Light</span>
                  {theme === 'light' && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    </div>
                  )}
                </button>

                <button
                  onClick={() => theme === 'light' && toggle()}
                  className={`relative flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all ${
                    theme === 'dark'
                      ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                    <Moon className="w-6 h-6 text-slate-300" />
                  </div>
                  <span className="font-semibold text-sm">Dark</span>
                  {theme === 'dark' && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── Security ── */}
        <TabsContent value="security">
          <div className="space-y-6">
            <form onSubmit={handleChangePassword}>
              <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Key className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg">Change Password</h2>
                    <p className="text-sm text-muted-foreground">Update your account password</p>
                  </div>
                </div>

                <div className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className="bg-secondary/30 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="bg-secondary/30"
                      required
                    />
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Passwords do not match
                      </p>
                    )}
                    {confirmPassword && newPassword === confirmPassword && newPassword.length >= 8 && (
                      <p className="text-xs text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Passwords match
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-start pt-2">
                  <Button
                    type="submit"
                    disabled={changingPassword || !newPassword || newPassword !== confirmPassword || newPassword.length < 8}
                    className="shadow-lg shadow-primary/20"
                  >
                    {changingPassword ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Key className="w-4 h-4 mr-2" />}
                    {changingPassword ? 'Updating...' : 'Update Password'}
                  </Button>
                </div>
              </div>
            </form>

            {/* Danger Zone */}
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-lg text-red-700 dark:text-red-400 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" /> Danger Zone
              </h3>
              <p className="text-sm text-red-600 dark:text-red-400">
                These actions are irreversible. Please proceed with caution.
              </p>
              <Button
                variant="destructive"
                onClick={async () => {
                  await signOut();
                  window.location.href = '/login';
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                Sign Out of All Devices
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
