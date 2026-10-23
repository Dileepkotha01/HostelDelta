'use client';

import { useState, useEffect, FormEvent } from 'react';
import { supabase } from '@/lib/supabase/client';
import { IndianMobileInput } from '@/components/ui/indian-mobile-input';
import { isValidIndianMobileNumber, toIndianMobileE164 } from '@/lib/indian-mobile';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  UserPlus,
  User,
  ShieldCheck,
  CreditCard,
  Check,
  ChevronRight,
  ChevronLeft,
  Upload,
  DoorOpen,
  IndianRupee,
  FileText,
  Calendar,
  Mail,
  Loader2,
} from 'lucide-react';
import type { Room } from '@/lib/types';

interface OnboardTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hostelId: string | null;
  userId?: string;
  onSuccess?: () => void;
  preselectedRoomId?: string;
  preselectedBedId?: string;
}

export function OnboardTenantDialog({
  open,
  onOpenChange,
  hostelId,
  userId,
  onSuccess,
  preselectedRoomId,
  preselectedBedId,
}: OnboardTenantDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // Step 1: Personal info
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  // Step 2: KYC & Room
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedBedId, setSelectedBedId] = useState('');
  const [idProofType, setIdProofType] = useState('aadhaar');
  const [idProofFile, setIdProofFile] = useState<File | null>(null);

  // Step 3: Billing & Agreement
  const [monthlyRent, setMonthlyRent] = useState('');
  const [securityDeposit, setSecurityDeposit] = useState('');
  const [rentDueDay, setRentDueDay] = useState('1');
  const [agreementStart, setAgreementStart] = useState('');
  const [agreementEnd, setAgreementEnd] = useState('');

  // Load rooms for room selection
  useEffect(() => {
    if (!open || !hostelId) return;
    async function loadRooms() {
      setLoadingRooms(true);
      const { data } = await supabase
        .from('rooms')
        .select('*, beds(*)')
        .eq('hostel_id', hostelId!)
        .order('room_number');
      setRooms((data || []) as Room[]);
      
      if (preselectedRoomId) setSelectedRoomId(preselectedRoomId);
      if (preselectedBedId) setSelectedBedId(preselectedBedId);
      
      const r = (data || []).find((r: any) => r.id === preselectedRoomId);
      if (r && !monthlyRent) setMonthlyRent(String(r.monthly_rent));
      
      setLoadingRooms(false);
    }
    loadRooms();
  }, [open, hostelId, preselectedRoomId, preselectedBedId]);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  const availableBeds = selectedRoom?.beds?.filter((b) => b.status === 'vacant') || [];

  // When room is selected, pre-fill monthly rent if not set
  function handleSelectRoom(roomId: string) {
    setSelectedRoomId(roomId);
    setSelectedBedId('');
    const room = rooms.find((r) => r.id === roomId);
    if (room && (!monthlyRent || monthlyRent === '0')) {
      setMonthlyRent(String(room.monthly_rent));
    }
  }

  function resetForm() {
    setFullName('');
    setPhone('');
    setEmail('');
    setEmergencyName('');
    setEmergencyPhone('');
    setSelectedRoomId('');
    setSelectedBedId('');
    setIdProofType('aadhaar');
    setIdProofFile(null);
    setMonthlyRent('');
    setSecurityDeposit('');
    setRentDueDay('1');
    setAgreementStart('');
    setAgreementEnd('');
    setStep(1);
  }

  function handleClose(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  }

  function validateStep1(): boolean {
    if (!fullName.trim()) {
      toast({ title: 'Full name is required', variant: 'destructive' });
      return false;
    }
    if (!phone.trim()) {
      toast({ title: 'Phone number is required', variant: 'destructive' });
      return false;
    }
    if (!isValidIndianMobileNumber(phone)) {
      toast({ title: 'Enter a valid 10-digit Indian mobile number', description: 'The +91 country code is already selected.', variant: 'destructive' });
      return false;
    }
    if (emergencyPhone && !isValidIndianMobileNumber(emergencyPhone)) {
      toast({ title: 'Enter a valid emergency contact number', description: 'Enter 10 digits; the +91 country code is already selected.', variant: 'destructive' });
      return false;
    }
    return true;
  }

  function validateStep2(): boolean {
    if (!selectedRoomId) {
      toast({ title: 'Please select a room', variant: 'destructive' });
      return false;
    }
    if (!selectedBedId) {
      toast({ title: 'Please select an available bed', variant: 'destructive' });
      return false;
    }
    return true;
  }

  function handleNext(e?: React.MouseEvent) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (step === 1) {
      if (!validateStep1()) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!validateStep2()) return;
      // If monthly rent isn't populated yet, populate from chosen room
      if (!monthlyRent && selectedRoom) {
        setMonthlyRent(String(selectedRoom.monthly_rent));
      }
      // Stop and go to Step 3
      setStep(3);
      return;
    }
  }

  async function handleOnboard(e?: FormEvent | React.MouseEvent) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // STRICT CHECK: Cannot onboard unless currently on Step 3
    if (step < 3) {
      handleNext();
      return;
    }

    if (!hostelId) {
      toast({ title: 'No hostel selected', variant: 'destructive' });
      return;
    }
    if (!monthlyRent || parseFloat(monthlyRent) <= 0) {
      toast({ title: 'Please enter a valid monthly rent amount', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    let onboardingEmailSent = false;
    try {
      let idProofUrl: string | null = null;
      if (idProofFile) {
        if (!userId) {
          throw new Error('Your account could not be identified. Please refresh and try again.');
        }

        const fileExt = idProofFile.name.split('.').pop()?.toLowerCase() || 'bin';
        const fileName = `${userId}/kyc/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('kyc-documents')
          .upload(fileName, idProofFile);

        if (uploadError) throw uploadError;
        idProofUrl = fileName;
      }

      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          hostel_id: hostelId,
          full_name: fullName.trim(),
          phone: toIndianMobileE164(phone),
          email: email.trim() || null,
          emergency_contact_name: emergencyName.trim() || null,
          emergency_contact_phone: emergencyPhone ? toIndianMobileE164(emergencyPhone) : null,
          id_proof_type: idProofType,
          id_proof_url: idProofUrl,
          monthly_rent: parseFloat(monthlyRent) || 0,
          security_deposit: parseFloat(securityDeposit) || 0,
          rent_due_day: parseInt(rentDueDay) || 1,
          agreement_start: agreementStart || null,
          agreement_end: agreementEnd || null,
          status: 'active',
          assigned_bed_id: selectedBedId || null,
        })
        .select()
        .single();

      if (tenantError) throw tenantError;

      // Mark bed occupied and update room status
      if (selectedBedId && tenant) {
        await supabase
          .from('beds')
          .update({
            status: 'occupied',
            tenant_id: tenant.id,
          })
          .eq('id', selectedBedId);

        // Also update parent room to occupied
        const chosenBed = availableBeds.find((b) => b.id === selectedBedId);
        if (chosenBed?.room_id) {
          await supabase
            .from('rooms')
            .update({ status: 'occupied' })
            .eq('id', chosenBed.room_id);
        }
      }

      // Generate first invoice
      if (tenant) {
        const now = new Date();
        const invoiceNumber = `INV-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${tenant.id.slice(0, 8)}`;
        const dueDate = new Date(now.getFullYear(), now.getMonth(), parseInt(rentDueDay) || 1);
        if (dueDate < now) dueDate.setMonth(dueDate.getMonth() + 1);

        await supabase.from('invoices').insert({
          hostel_id: hostelId,
          tenant_id: tenant.id,
          invoice_number: invoiceNumber,
          billing_month: now.getMonth() + 1,
          billing_year: now.getFullYear(),
          amount: parseFloat(monthlyRent) || 0,
          due_date: dueDate.toISOString().split('T')[0],
          status: 'pending',
        });

        // Generate Advance Payment invoice if applicable
        const advanceAmount = parseFloat(securityDeposit) || 0;
        if (advanceAmount > 0) {
          const advanceInvoiceNumber = `ADV-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${tenant.id.slice(0, 8)}`;
          await supabase.from('invoices').insert({
            hostel_id: hostelId,
            tenant_id: tenant.id,
            invoice_number: advanceInvoiceNumber,
            billing_month: now.getMonth() + 1,
            billing_year: now.getFullYear(),
            amount: advanceAmount,
            due_date: now.toISOString().split('T')[0],
            status: 'pending',
          });
        }

        // Send welcome email with tenant portal link if email provided
        if (email.trim()) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
              throw new Error('Sign in again before sending an onboarding email.');
            }

            const emailRes = await fetch('/api/tenants/send-onboarding-email', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                tenantId: tenant.id,
              }),
            });
            const emailData = await emailRes.json();
            if (!emailRes.ok || !emailData.emailSent) {
              console.warn('Onboarding email dispatch warning:', emailData);
            } else {
              onboardingEmailSent = true;
            }
          } catch (e) {
            console.error('Email trigger error:', e);
          }
        }
      }

      toast({
        title: 'Tenant onboarded successfully! 🎉',
        description: email.trim()
          ? onboardingEmailSent
            ? `${fullName} added. Welcome email with portal link sent to ${email}.`
            : `${fullName} added, but the welcome email could not be sent. Please retry or contact support.`
          : `${fullName} has been added and assigned to room.`,
      });

      handleClose(false);
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to onboard tenant';
      toast({ title: 'Onboarding failed', description: message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  const stepsMeta = [
    { s: 1, label: 'Profile', sub: 'Personal Info' },
    { s: 2, label: 'KYC & Room', sub: 'Verification & Bed' },
    { s: 3, label: 'Billing', sub: 'Rent & Agreement' },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-24px)] sm:w-full max-w-2xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-card border-border rounded-2xl sm:rounded-3xl shadow-2xl">
        {/* Header with Centered Stepper */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 sm:p-6 pb-3 sm:pb-5 border-b shrink-0">
          <DialogHeader className="text-center sm:text-left">
            <DialogTitle className="text-lg sm:text-2xl font-bold flex items-center justify-center sm:justify-start gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm shadow-primary/20 shrink-0">
                <UserPlus className="w-4 h-4" />
              </div>
              <span>Onboard New Tenant</span>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
              Add resident details, assign room bed, verify KYC, and set billing parameters.
            </DialogDescription>
          </DialogHeader>

          {/* ── PERFECTLY CENTERED STEPPER PROGRESS BAR ── */}
          <div className="mt-5 px-1 sm:px-4">
            <div className="flex items-center justify-between max-w-lg mx-auto">
              {stepsMeta.map(({ s, label, sub }, idx) => {
                const isCompleted = step > s;
                const isActive = step === s;
                return (
                  <div key={s} className="flex-1 flex flex-col items-center">
                    <div className="flex items-center w-full">
                      {/* Left connecting line */}
                      <div
                        className={`h-0.5 sm:h-1 flex-1 transition-all ${
                          idx === 0
                            ? 'invisible'
                            : isCompleted || isActive
                            ? 'bg-primary'
                            : 'bg-muted-foreground/20'
                        }`}
                      />

                      {/* Step Circle */}
                      <button
                        type="button"
                        onClick={() => {
                          if (s < step) setStep(s);
                        }}
                        disabled={s > step}
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold shrink-0 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed ${
                          isCompleted
                            ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:opacity-90'
                            : isActive
                            ? 'bg-primary text-primary-foreground ring-4 ring-primary/20 shadow-md shadow-primary/30 scale-105'
                            : 'bg-secondary text-muted-foreground border border-border'
                        }`}
                      >
                        {isCompleted ? <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" /> : s}
                      </button>

                      {/* Right connecting line */}
                      <div
                        className={`h-0.5 sm:h-1 flex-1 transition-all ${
                          idx === stepsMeta.length - 1
                            ? 'invisible'
                            : isCompleted
                            ? 'bg-primary'
                            : 'bg-muted-foreground/20'
                        }`}
                      />
                    </div>

                    {/* Step Labels Centered Below Circle */}
                    <div className="mt-2 text-center flex flex-col items-center">
                      <span
                        className={`text-[11px] sm:text-xs font-bold leading-tight ${
                          isActive
                            ? 'text-primary'
                            : isCompleted
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {label}
                      </span>
                      <span className="text-[9px] sm:text-[10px] text-muted-foreground hidden sm:block mt-0.5">
                        {sub}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content Body - Scrollable */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 no-scrollbar">
            {/* ── STEP 1: PERSONAL INFORMATION ── */}
            {step === 1 && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <User className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-base sm:text-lg">Personal Information</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="tenant-full-name" className="text-xs sm:text-sm font-semibold">
                      Full Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="tenant-full-name"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleNext();
                        }
                      }}
                      placeholder="e.g. Rahul Sharma"
                      className="h-10 text-sm rounded-xl"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="tenant-phone" className="text-xs sm:text-sm font-semibold">
                      Phone Number <span className="text-red-500">*</span>
                    </Label>
                    <IndianMobileInput
                      id="tenant-phone"
                      required
                      value={phone}
                      onChange={setPhone}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleNext();
                        }
                      }}
                      className="rounded-xl"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="tenant-email" className="text-xs sm:text-sm font-semibold">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="tenant-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleNext();
                          }
                        }}
                        placeholder="rahul@example.com"
                        className="pl-9 h-10 text-sm rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="tenant-em-name" className="text-xs sm:text-sm font-semibold">
                      Emergency Contact Name
                    </Label>
                    <Input
                      id="tenant-em-name"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleNext();
                        }
                      }}
                      placeholder="Parent / Guardian Name"
                      className="h-10 text-sm rounded-xl"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="tenant-em-phone" className="text-xs sm:text-sm font-semibold">
                      Emergency Contact Phone
                    </Label>
                    <IndianMobileInput
                      id="tenant-em-phone"
                      value={emergencyPhone}
                      onChange={setEmergencyPhone}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleNext();
                        }
                      }}
                      className="rounded-xl"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 2: KYC & ROOM ALLOCATION ── */}
            {step === 2 && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-base sm:text-lg">KYC & Room Allocation</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                  {/* Select Room */}
                  <div className="space-y-1.5">
                    <Label htmlFor="tenant-room-select" className="text-xs sm:text-sm font-semibold">
                      Select Room <span className="text-red-500">*</span>
                    </Label>
                    <Select value={selectedRoomId} onValueChange={handleSelectRoom}>
                      <SelectTrigger id="tenant-room-select" className="h-10 text-sm rounded-xl">
                        <SelectValue placeholder={loadingRooms ? 'Loading rooms...' : 'Choose a room'} />
                      </SelectTrigger>
                      <SelectContent>
                        {rooms.map((r) => {
                          const vacantCount = r.beds?.filter((b) => b.status === 'vacant').length || 0;
                          return (
                            <SelectItem key={r.id} value={r.id}>
                              Room #{r.room_number} ({r.room_type}) — ₹{r.monthly_rent} ({vacantCount} vacant)
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Select Bed */}
                  <div className="space-y-1.5">
                    <Label htmlFor="tenant-bed-select" className="text-xs sm:text-sm font-semibold">
                      Select Bed <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={selectedBedId}
                      onValueChange={setSelectedBedId}
                      disabled={!selectedRoomId || availableBeds.length === 0}
                    >
                      <SelectTrigger id="tenant-bed-select" className="h-10 text-sm rounded-xl">
                        <SelectValue
                          placeholder={
                            !selectedRoomId
                              ? 'Select room first'
                              : availableBeds.length === 0
                              ? 'No vacant beds'
                              : 'Choose a bed'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {availableBeds.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            Bed {b.bed_label} (Vacant)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* ID Proof Type */}
                  <div className="space-y-1.5">
                    <Label htmlFor="tenant-id-type" className="text-xs sm:text-sm font-semibold">
                      ID Proof Type
                    </Label>
                    <Select value={idProofType} onValueChange={setIdProofType}>
                      <SelectTrigger id="tenant-id-type" className="h-10 text-sm rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aadhaar">Aadhaar Card</SelectItem>
                        <SelectItem value="passport">Passport</SelectItem>
                        <SelectItem value="driving_license">Driving License</SelectItem>
                        <SelectItem value="voter_id">Voter ID</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* ID File Upload */}
                  <div className="space-y-1.5">
                    <Label htmlFor="tenant-id-file" className="text-xs sm:text-sm font-semibold">
                      Upload Aadhaar / ID Document
                    </Label>
                    <div className="relative">
                      <Input
                        id="tenant-id-file"
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => setIdProofFile(e.target.files?.[0] || null)}
                        className="h-10 text-xs sm:text-sm rounded-xl file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                      />
                    </div>
                  </div>
                </div>

                {/* KYC Aadhaar Callout */}
                <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 flex items-start gap-3">
                  <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-semibold text-indigo-950 dark:text-indigo-200">Aadhaar Card Verification</p>
                    <p className="text-indigo-700 dark:text-indigo-300/80 mt-0.5">
                      Uploading an Aadhaar card will enable instant digital KYC preview and verification inside the tenant details sheet.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 3: BILLING & AGREEMENT ── */}
            {step === 3 && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-base sm:text-lg">Billing & Agreement Details</h3>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/15 text-primary">
                    Final Step: Review & Edit
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs text-foreground/80 flex items-center gap-2">
                  <span className="font-bold text-primary">💡 Important:</span>
                  Please review and modify the monthly rent, advance payment, and agreement dates below before finishing onboarding.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="tenant-rent" className="text-xs sm:text-sm font-semibold flex items-center justify-between">
                      <span>Monthly Rent (₹) <span className="text-red-500">*</span></span>
                      {selectedRoom?.monthly_rent ? (
                        <span className="text-[11px] font-normal text-muted-foreground">
                          Room Base: ₹{selectedRoom.monthly_rent}
                        </span>
                      ) : null}
                    </Label>
                    <div className="relative">
                      <IndianRupee className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="tenant-rent"
                        required
                        type="number"
                        value={monthlyRent}
                        onChange={(e) => setMonthlyRent(e.target.value)}
                        placeholder="e.g. 6500"
                        className="pl-9 h-10 text-sm rounded-xl font-semibold bg-background"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="tenant-deposit" className="text-xs sm:text-sm font-semibold">
                      Advance / Security Deposit (₹)
                    </Label>
                    <div className="relative">
                      <IndianRupee className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="tenant-deposit"
                        type="number"
                        value={securityDeposit}
                        onChange={(e) => setSecurityDeposit(e.target.value)}
                        placeholder="e.g. 5000"
                        className="pl-9 h-10 text-sm rounded-xl font-semibold bg-background"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">One-time advance/deposit collected upon joining.</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="tenant-due-day" className="text-xs sm:text-sm font-semibold">
                      Rent Due Day of Month (1-28)
                    </Label>
                    <Input
                      id="tenant-due-day"
                      type="number"
                      min="1"
                      max="28"
                      value={rentDueDay}
                      onChange={(e) => setRentDueDay(e.target.value)}
                      placeholder="1"
                      className="h-10 text-sm rounded-xl"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="tenant-start-date" className="text-xs sm:text-sm font-semibold">
                      Agreement Start Date
                    </Label>
                    <Input
                      id="tenant-start-date"
                      type="date"
                      value={agreementStart}
                      onChange={(e) => setAgreementStart(e.target.value)}
                      className="h-10 text-sm rounded-xl"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="tenant-end-date" className="text-xs sm:text-sm font-semibold">
                      Agreement End Date (Optional)
                    </Label>
                    <Input
                      id="tenant-end-date"
                      type="date"
                      value={agreementEnd}
                      onChange={(e) => setAgreementEnd(e.target.value)}
                      className="h-10 text-sm rounded-xl"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-secondary/50 border text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground mb-0.5">Automated First Invoice</p>
                  Completing onboarding will automatically generate the initial pending rent invoice and mark the selected bed as occupied.
                </div>
              </div>
            )}
          </div>

          {/* Footer Navigation */}
          <div className="p-4 sm:px-6 border-t shrink-0 flex items-center justify-between bg-card/90 backdrop-blur-sm">
            {step > 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep((s) => s - 1)}
                className="h-9 sm:h-10 text-xs sm:text-sm rounded-xl"
              >
                <ChevronLeft className="w-4 h-4 mr-1.5" /> Back
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleClose(false)}
                className="h-9 sm:h-10 text-xs sm:text-sm rounded-xl text-muted-foreground"
              >
                Cancel
              </Button>
            )}

            {step === 1 && (
              <Button
                type="button"
                onClick={() => handleNext()}
                className="h-9 sm:h-10 text-xs sm:text-sm rounded-xl px-4 sm:px-6 shadow-md shadow-primary/20"
              >
                Next: KYC & Room <ChevronRight className="w-4 h-4 ml-1.5" />
              </Button>
            )}

            {step === 2 && (
              <Button
                type="button"
                onClick={() => handleNext()}
                className="h-9 sm:h-10 text-xs sm:text-sm rounded-xl px-4 sm:px-6 shadow-md shadow-primary/20"
              >
                Next: Rent & Advance (Step 3) <ChevronRight className="w-4 h-4 ml-1.5" />
              </Button>
            )}

            {step === 3 && (
              <Button
                type="button"
                onClick={() => void handleOnboard()}
                disabled={submitting}
                className="h-9 sm:h-10 text-xs sm:text-sm rounded-xl px-4 sm:px-6 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...
                  </>
                ) : (
                  'Complete Onboarding'
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
