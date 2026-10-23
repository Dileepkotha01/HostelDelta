'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase/client';
import type { HostelOnboardingDraftData, PendingHostelOnboarding } from '@/lib/hostel-onboarding';
import { IndianMobileInput } from '@/components/ui/indian-mobile-input';
import { isValidIndianMobileNumber } from '@/lib/indian-mobile';
import {
  HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_INR,
  HOSTEL_SUBSCRIPTION_TRIAL_DAYS,
} from '@/lib/hostel-subscription';
import {
  Loader2, Building, ShieldCheck, CheckCircle2, ChevronRight, ChevronLeft,
  Wifi, Droplets, Utensils, Snowflake, Zap,
  Camera, IndianRupee, BedDouble, Layers, AlertCircle, CreditCard, CalendarDays,
  Clock3, XCircle,
  X,
} from 'lucide-react';

type RazorpayCheckoutResponse =
  | {
      mode: 'AUTO_PAY';
      razorpay_payment_id: string;
      razorpay_subscription_id: string;
      razorpay_signature: string;
    }
  | {
      mode: 'ONE_TIME';
      razorpay_payment_id: string;
      razorpay_order_id: string;
      razorpay_signature: string;
    };

interface RazorpayCheckoutPayload {
  razorpay_payment_id: string;
  razorpay_subscription_id?: string;
  razorpay_order_id?: string;
  razorpay_signature: string;
}

interface RazorpayPaymentFailure {
  error?: {
    code?: string;
    description?: string;
    reason?: string;
    source?: string;
    step?: string;
  };
}

interface RazorpayCheckoutOptions {
  key: string;
  subscription_id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
  notes?: { onboarding_id: string };
  theme: { color: string };
  handler: (response: RazorpayCheckoutPayload) => void;
  modal?: { ondismiss: () => void };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => {
      open: () => void;
      on: (event: 'payment.failed', handler: (response: RazorpayPaymentFailure) => void) => void;
    };
  }
}

// ── Types ────────────────────────────────────────────────────────────────────
interface RoomConfig {
  roomNumber: string;
  sharing: string;
  customSharing: string;
  rent: string;
}

interface FloorConfig {
  floorNumber: number;
  label: string;
  roomCount: number;
  rooms: RoomConfig[];
}

interface AmenitiesForm {
  wifi: boolean;
  hot_water: boolean;
  washing_machine: boolean;
  fridge: boolean;
  ac: boolean;
  cctv: boolean;
  power_backup: boolean;
  housekeeping: boolean;
}

interface FoodForm {
  mess_available: boolean;
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
  veg_only: boolean;
  non_veg: boolean;
  food_notes: string;
}

interface BasicForm {
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  gstin: string;
  amenities: AmenitiesForm;
  food: FoodForm;
}

interface OnboardHostelWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onSuccess?: (hostelId: string) => void;
  resumeDraft?: PendingHostelOnboarding | null;
}

function createDefaultBasicForm(): BasicForm {
  return {
    name: '', address: '', city: '', state: '', phone: '', email: '', gstin: '',
    amenities: { wifi: false, hot_water: false, washing_machine: false, fridge: false, ac: false, cctv: false, power_backup: false, housekeeping: false },
    food: { mess_available: false, breakfast: false, lunch: false, dinner: false, veg_only: false, non_veg: false, food_notes: '' },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const SHARING_OPTIONS = [
  { value: '1', label: '1 Sharing (Private)' },
  { value: '2', label: '2 Sharing' },
  { value: '3', label: '3 Sharing' },
  { value: '4', label: '4 Sharing' },
  { value: '5', label: '5 Sharing' },
  { value: 'custom', label: 'Custom' },
];

function generateRoomNumber(floorNum: number, roomIndex: number): string {
  const padded = String(roomIndex + 1).padStart(2, '0');
  return `${floorNum}${padded}`;
}

function buildDefaultRooms(
  floorNum: number, count: number,
  defaultSharing: string, defaultRent: string,
  existingRooms: RoomConfig[] = []
): RoomConfig[] {
  return Array.from({ length: count }, (_, i) => ({
    roomNumber: existingRooms[i]?.roomNumber ?? generateRoomNumber(floorNum, i),
    sharing: existingRooms[i]?.sharing ?? defaultSharing,
    customSharing: existingRooms[i]?.customSharing ?? '',
    rent: existingRooms[i]?.rent ?? defaultRent,
  }));
}

function totalBeds(floors: FloorConfig[]): number {
  return floors.reduce((sum, f) =>
    sum + f.rooms.reduce((rs, r) => {
      const s = r.sharing === 'custom' ? parseInt(r.customSharing) || 0 : parseInt(r.sharing) || 0;
      return rs + s;
    }, 0), 0);
}

// ── Main Component ────────────────────────────────────────────────────────────
export function OnboardHostelWizard({ open, onOpenChange, userId, onSuccess, resumeDraft }: OnboardHostelWizardProps) {
  const { toast } = useToast();
  const onboardingId = useRef<string | null>(null);
  const createdHostelId = useRef<string | null>(null);
  const paymentAuthorization = useRef<RazorpayCheckoutResponse | null>(null);
  const checkoutStatus = useRef<'open' | 'failed' | 'authorized' | null>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentState, setPaymentState] = useState<'idle' | 'processing' | 'failed' | 'setup_failed' | 'success'>('idle');
  const [paymentMessage, setPaymentMessage] = useState('');
  const [billingMode, setBillingMode] = useState<'AUTO_PAY' | 'ONE_TIME'>('ONE_TIME');

  const [basic, setBasic] = useState<BasicForm>(createDefaultBasicForm);

  const [totalFloors, setTotalFloors] = useState(1);
  const [defaultSharing, setDefaultSharing] = useState('2');
  const [defaultRent, setDefaultRent] = useState('');
  const [floors, setFloors] = useState<FloorConfig[]>([
    { floorNumber: 1, label: 'Floor 1', roomCount: 0, rooms: [] },
  ]);
  const [expandedFloor, setExpandedFloor] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    if (resumeDraft) {
      const isSameOnboarding = onboardingId.current === resumeDraft.onboarding_id;
      onboardingId.current = resumeDraft.onboarding_id;
      if (!isSameOnboarding) paymentAuthorization.current = null;
      setBasic(resumeDraft.draft.basic);
      setTotalFloors(resumeDraft.draft.totalFloors);
      setDefaultSharing(resumeDraft.draft.defaultSharing);
      setDefaultRent(resumeDraft.draft.defaultRent);
      setFloors(resumeDraft.draft.floors);
      setStep(3);
      setBillingMode(resumeDraft.billingMode || 'ONE_TIME');
    } else {
      onboardingId.current = null;
      paymentAuthorization.current = null;
      setBasic(createDefaultBasicForm());
      setTotalFloors(1);
      setDefaultSharing('2');
      setDefaultRent('');
      setFloors([{ floorNumber: 1, label: 'Floor 1', roomCount: 0, rooms: [] }]);
      setStep(1);
      setBillingMode('ONE_TIME');
    }
    checkoutStatus.current = null;
    setCheckoutOpen(false);
    setPaymentState('idle');
    setPaymentMessage('');
  }, [open, resumeDraft]);

  const syncFloors = useCallback((count: number, curFloors: FloorConfig[]) => {
    setFloors(Array.from({ length: count }, (_, i) => {
      const existing = curFloors.find(f => f.floorNumber === i + 1);
      if (existing) return existing;
      return { floorNumber: i + 1, label: `Floor ${i + 1}`, roomCount: 0, rooms: [] };
    }));
  }, []);

  const handleTotalFloorsChange = (val: number) => {
    const n = Math.max(1, Math.min(20, val));
    setTotalFloors(n); syncFloors(n, floors);
  };

  const handleFloorRoomCount = (fi: number, count: number) => {
    const n = Math.max(0, Math.min(50, count));
    setFloors(prev => prev.map((f, i) =>
      i !== fi ? f : { ...f, roomCount: n, rooms: buildDefaultRooms(f.floorNumber, n, defaultSharing, defaultRent, f.rooms) }
    ));
  };

  const handleRoomField = (fi: number, ri: number, field: keyof RoomConfig, value: string) => {
    setFloors(prev => prev.map((f, ffi) =>
      ffi !== fi ? f : { ...f, rooms: f.rooms.map((r, rri) => rri !== ri ? r : { ...r, [field]: value }) }
    ));
  };

  const applyDefaultsToAll = () => {
    setFloors(prev => prev.map(f => ({ ...f, rooms: f.rooms.map(r => ({ ...r, sharing: defaultSharing, rent: defaultRent })) })));
    toast({ title: 'Applied defaults to all rooms ✅' });
  };

  const validateStep1 = () => {
    if (basic.name.trim().length < 2) { toast({ title: 'Enter a hostel name with at least 2 characters', variant: 'destructive' }); return false; }
    if (!basic.city.trim()) { toast({ title: 'City is required', variant: 'destructive' }); return false; }
    if (basic.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(basic.email.trim())) {
      toast({ title: 'Enter a valid contact email address', variant: 'destructive' });
      return false;
    }
    if (basic.gstin.trim() && !/^[0-9A-Z]{15}$/i.test(basic.gstin.trim())) {
      toast({ title: 'Enter a valid 15-character GSTIN', variant: 'destructive' });
      return false;
    }
    if (basic.phone && !isValidIndianMobileNumber(basic.phone)) {
      toast({ title: 'Enter a valid 10-digit Indian contact number', description: 'The +91 country code is already selected.', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    const allRooms = floors.flatMap(floor => floor.rooms);
    const emptyFloor = floors.find(floor => floor.rooms.length === 0);
    if (emptyFloor) {
      toast({ title: `Add at least one room to Floor ${emptyFloor.floorNumber}`, variant: 'destructive' });
      return false;
    }
    if (allRooms.length > 500) {
      toast({ title: 'A hostel can have at most 500 rooms per setup', variant: 'destructive' });
      return false;
    }
    const roomNumbers = allRooms.map(room => room.roomNumber.trim().toLowerCase());
    if (roomNumbers.some(number => !number) || new Set(roomNumbers).size !== roomNumbers.length) {
      toast({ title: 'Enter a unique room number for every room', variant: 'destructive' });
      return false;
    }
    for (const floor of floors) {
      for (const room of floor.rooms) {
        const sharing = room.sharing === 'custom' ? Number(room.customSharing) : Number(room.sharing);
        if (!Number.isInteger(sharing) || sharing < 1 || sharing > 10) {
          toast({ title: `Room ${room.roomNumber}: sharing must be between 1 and 10 beds`, variant: 'destructive' }); return false;
        }
        const rent = Number(room.rent);
        if (!Number.isFinite(rent) || rent <= 0 || rent > 10000000) {
          toast({ title: `Room ${room.roomNumber}: Enter a valid rent amount`, variant: 'destructive' }); return false;
        }
      }
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep(s => s + 1);
  };

  const provisionHostel = async (
    payment: RazorpayCheckoutResponse,
    referenceId: string,
    accessToken: string,
    roomsPayload: { floorNumber: number; roomNumber: string; sharing: number; rent: number }[],
    foodDetails: string
  ) => {
    const setupResponse = await fetch('/api/hostels/setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        ownerId: userId,
        hostel: {
          name: basic.name,
          address: basic.address,
          city: basic.city,
          state: basic.state,
          phone: basic.phone,
          email: basic.email,
          gstin: basic.gstin,
          amenities: basic.amenities,
          food_details: foodDetails,
        },
        rooms: roomsPayload,
        totalFloors: floors.length,
        payment: {
          mode: payment.mode,
          onboardingId: referenceId,
          ...(payment.mode === 'AUTO_PAY'
            ? { subscriptionId: payment.razorpay_subscription_id }
            : { orderId: payment.razorpay_order_id }),
          paymentId: payment.razorpay_payment_id,
          signature: payment.razorpay_signature,
        },
      }),
    });
    const setupResult = await setupResponse.json().catch(() => ({})) as { error?: string; emailSent?: boolean; hostelId?: string; billingHistoryWarning?: boolean };
    if (!setupResponse.ok) {
      throw new Error(setupResult.error || `Hostel setup failed (HTTP ${setupResponse.status}).`);
    }
    if (!setupResult.hostelId) {
      throw new Error('Payment succeeded, but the created hostel could not be identified. Refresh the dashboard or contact support.');
    }

    createdHostelId.current = setupResult.hostelId;
    paymentAuthorization.current = null;
    checkoutStatus.current = 'authorized';
    setCheckoutOpen(false);
    setPaymentMessage(`${basic.name} is ready with ${roomsPayload.length} rooms. Clicking Done will open its dashboard. ${payment.mode === 'AUTO_PAY'
      ? `Your ${HOSTEL_SUBSCRIPTION_TRIAL_DAYS}-day free trial has started and monthly renewal is enabled.`
      : `Your one-time payment covers the next ${HOSTEL_SUBSCRIPTION_TRIAL_DAYS} days; renew manually to keep using the hostel.`}${setupResult.emailSent === false ? ' We could not send the confirmation email; please check the email service configuration.' : ' A confirmation email was sent to your account email.'}${setupResult.billingHistoryWarning ? ` Payment succeeded, but the billing history could not be recorded. Keep payment reference ${payment.razorpay_payment_id} and contact support.` : ''}`);
    setPaymentState('success');
  };

  const persistDraft = async (
    accessToken: string,
    referenceId: string,
    draft: HostelOnboardingDraftData,
    event?: 'PROCESSING' | 'PAYMENT_FAILED'
  ) => {
    const response = await fetch('/api/hostels/onboarding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ onboardingId: referenceId, draft, event }),
    });
    const result = await response.json().catch(() => ({})) as { error?: string; emailSent?: boolean | null };
    if (!response.ok) throw new Error(result.error || `Unable to save hostel details (HTTP ${response.status}).`);
    if (event && result.emailSent === false) {
      toast({
        title: 'Payment email could not be sent',
        description: 'Your hostel details are saved. Check the email service configuration; you can still continue payment.',
        variant: 'destructive',
      });
    }
  };

  const handleCompleteSetup = async () => {
    setLoading(true);
    try {
      const roomsPayload = floors.flatMap(floor =>
        floor.rooms.map(room => ({
          floorNumber: floor.floorNumber,
          roomNumber: room.roomNumber,
          sharing: room.sharing === 'custom' ? parseInt(room.customSharing) || 1 : parseInt(room.sharing) || 1,
          rent: parseFloat(room.rent) || 0,
        }))
      );

      const foodDetails = basic.food.mess_available
        ? `Mess: Yes | ${[basic.food.breakfast && 'Breakfast', basic.food.lunch && 'Lunch', basic.food.dinner && 'Dinner'].filter(Boolean).join(', ')} | ${basic.food.veg_only ? 'Veg Only' : basic.food.non_veg ? 'Veg & Non-Veg' : ''} | ${basic.food.food_notes}`
        : basic.food.food_notes || 'No mess';
      const draft: HostelOnboardingDraftData = {
        basic,
        totalFloors,
        defaultSharing,
        defaultRent,
        floors,
      };

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('Not authenticated. Please sign in again.');

      const referenceId = onboardingId.current || crypto.randomUUID();
      onboardingId.current = referenceId;
      if (paymentAuthorization.current) {
        await provisionHostel(paymentAuthorization.current, referenceId, accessToken, roomsPayload, foodDetails);
        setLoading(false);
        return;
      }

      await persistDraft(accessToken, referenceId, draft);
      const response = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ onboardingId: referenceId, billingMode }),
      });
      const checkout = await response.json().catch(() => ({})) as {
        error?: string;
        billingMode?: 'AUTO_PAY' | 'ONE_TIME';
        keyId?: string;
        subscriptionId?: string;
        orderId?: string;
        amount?: number;
        currency?: string;
        ownerName?: string;
        ownerEmail?: string;
        ownerPhone?: string;
      };
      if (!response.ok) {
        throw new Error(checkout.error || `Subscription setup failed (HTTP ${response.status}).`);
      }
      if (
        !checkout.keyId ||
        (billingMode === 'AUTO_PAY' && !checkout.subscriptionId) ||
        (billingMode === 'ONE_TIME' && !checkout.orderId) ||
        !window.Razorpay
      ) {
        throw new Error('Secure payment checkout is unavailable. Please refresh and try again.');
      }

      await persistDraft(accessToken, referenceId, draft, 'PROCESSING');
      checkoutStatus.current = 'open';
      const razorpay = new window.Razorpay({
        key: checkout.keyId,
        ...(billingMode === 'AUTO_PAY'
          ? { subscription_id: checkout.subscriptionId }
          : { order_id: checkout.orderId }),
        name: 'Kupera',
        description: billingMode === 'AUTO_PAY'
          ? `₹${HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_INR.toLocaleString('en-IN')} monthly after your ${HOSTEL_SUBSCRIPTION_TRIAL_DAYS}-day free trial`
          : `One-time payment for ${HOSTEL_SUBSCRIPTION_TRIAL_DAYS} days of HostelHub`,
        prefill: {
          name: checkout.ownerName || '',
          email: checkout.ownerEmail || '',
          contact: checkout.ownerPhone || '',
        },
        notes: { onboarding_id: referenceId },
        theme: { color: '#4f46e5' },
        handler: (razorpayResponse) => {
          const payment: RazorpayCheckoutResponse | null = billingMode === 'AUTO_PAY' && razorpayResponse.razorpay_subscription_id
            ? { ...razorpayResponse, mode: 'AUTO_PAY', razorpay_subscription_id: razorpayResponse.razorpay_subscription_id }
            : billingMode === 'ONE_TIME' && razorpayResponse.razorpay_order_id
              ? { ...razorpayResponse, mode: 'ONE_TIME', razorpay_order_id: razorpayResponse.razorpay_order_id }
              : null;
          if (!payment) {
            checkoutStatus.current = 'failed';
            setCheckoutOpen(false);
            setPaymentMessage('Razorpay did not return the expected payment reference. Your hostel details remain saved; try payment again.');
            setPaymentState('failed');
            setLoading(false);
            return;
          }
          checkoutStatus.current = 'authorized';
          setCheckoutOpen(false);
          setPaymentState('processing');
          setPaymentMessage('Payment authorized. We are creating your hostel workspace...');
          paymentAuthorization.current = payment;
          void provisionHostel(payment, referenceId, accessToken, roomsPayload, foodDetails)
            .catch((error: unknown) => {
              checkoutStatus.current = 'authorized';
              setCheckoutOpen(false);
              const details = error instanceof Error ? error.message : 'The server could not finish verifying the authorization.';
              setPaymentMessage(`Razorpay returned an authorization response, but hostel setup could not be completed. Retrying will reuse this response instead of starting another payment. ${details}`);
              setPaymentState('setup_failed');
            })
            .finally(() => setLoading(false));
        },
        modal: {
          ondismiss: () => {
            setCheckoutOpen(false);
            setLoading(false);
            if (checkoutStatus.current === 'failed' || checkoutStatus.current === 'authorized') return;
            checkoutStatus.current = null;
            setPaymentMessage('Your hostel details are saved. Continue payment now or come back from the dashboard later.');
            setPaymentState('processing');
            void persistDraft(accessToken, referenceId, draft, 'PROCESSING').catch((error: unknown) => {
              console.error('Unable to record dismissed hostel checkout:', error);
            });
          },
        },
      });
      razorpay.on('payment.failed', (failure) => {
        checkoutStatus.current = 'failed';
        setCheckoutOpen(false);
        paymentAuthorization.current = null;
        const failureDetails = [
          failure.error?.description,
          failure.error?.reason && `Reason: ${failure.error.reason}`,
          failure.error?.code && `Code: ${failure.error.code}`,
          failure.error?.source && `Source: ${failure.error.source}`,
          failure.error?.step && `Step: ${failure.error.step}`,
        ].filter(Boolean);
        const details = failureDetails.join(' · ') || 'Razorpay could not authorize this payment.';
        setPaymentMessage(`Payment for ${basic.name} failed. ${details}`);
        setPaymentState('failed');
        setLoading(false);
        void persistDraft(accessToken, referenceId, draft, 'PAYMENT_FAILED').catch((error: unknown) => {
          console.error('Unable to record failed hostel payment:', error);
        });
      });
      setCheckoutOpen(true);
      window.requestAnimationFrame(() => razorpay.open());
    } catch (err: unknown) {
      setCheckoutOpen(false);
      const details = err instanceof Error ? err.message : 'An unexpected error occurred while preparing your hostel payment.';
      if (paymentAuthorization.current) {
        setPaymentMessage(`Razorpay returned an authorization response, but hostel setup could not be completed. Retrying will reuse this response instead of starting another payment. ${details}`);
        setPaymentState('setup_failed');
      } else {
        setPaymentMessage(details);
        setPaymentState('failed');
      }
      setLoading(false);
    }
  };

  const continuePayment = () => {
    setPaymentState('idle');
    setCheckoutOpen(true);
    void handleCompleteSetup();
  };

  const finishSuccess = () => {
    onOpenChange(false);
    if (createdHostelId.current) onSuccess?.(createdHostelId.current);
  };

  const totalRooms = floors.reduce((s, f) => s + f.rooms.length, 0);
  const totalBedsCount = totalBeds(floors);

  const toggleAmenity = (key: keyof AmenitiesForm) =>
    setBasic(b => ({ ...b, amenities: { ...b.amenities, [key]: !b.amenities[key] } }));

  const toggleFood = (key: keyof Omit<FoodForm, 'food_notes'>) =>
    setBasic(b => ({ ...b, food: { ...b.food, [key]: !b.food[key] } }));

  const AMENITIES: { id: keyof AmenitiesForm; icon: React.ElementType; label: string }[] = [
    { id: 'wifi', icon: Wifi, label: 'WiFi' },
    { id: 'hot_water', icon: Droplets, label: 'Hot Water' },
    { id: 'washing_machine', icon: BedDouble, label: 'Washing Machine' },
    { id: 'fridge', icon: Snowflake, label: 'Refrigerator' },
    { id: 'ac', icon: Snowflake, label: 'Air Conditioning' },
    { id: 'cctv', icon: Camera, label: 'CCTV Security' },
    { id: 'power_backup', icon: Zap, label: 'Power Backup' },
    { id: 'housekeeping', icon: ShieldCheck, label: 'Housekeeping' },
  ];

  return (
    <Dialog open={open && !checkoutOpen} onOpenChange={v => { if (!loading) onOpenChange(v); }}>
      <DialogContent className={paymentState === 'idle'
        ? 'sm:max-w-2xl bg-card border-border text-foreground p-0 overflow-hidden max-h-[95vh] flex flex-col'
        : 'w-[calc(100%-2rem)] max-w-sm bg-card border-border text-foreground rounded-2xl p-6 shadow-2xl'}>

        {paymentState === 'idle' ? <>
        {/* Header + Progress */}
        <div className="bg-gradient-to-r from-indigo-600/20 via-indigo-500/10 to-transparent p-5 pb-4 border-b border-border shrink-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Building className="h-5 w-5 text-indigo-400" /> Add Your Hostel
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Enter the property details and room inventory to create your hostel workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 mt-4">
            {['Basic Info & Amenities', 'Room Builder', 'Review & Create'].map((label, i) => (
              <React.Fragment key={i}>
                <div className="flex flex-col items-center gap-1">
                  <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border-2 transition-all ${
                    step > i + 1 ? 'bg-emerald-500 border-emerald-500 text-white' :
                    step === i + 1 ? 'bg-indigo-600 border-indigo-500 text-white' :
                    'bg-secondary border-border text-muted-foreground'
                  }`}>
                    {step > i + 1 ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={`text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap ${step === i + 1 ? 'text-indigo-600 dark:text-indigo-300' : 'text-muted-foreground'}`}>
                    {label}
                  </span>
                </div>
                {i < 2 && <div className={`flex-1 h-0.5 rounded mb-4 ${step > i + 1 ? 'bg-emerald-500' : 'bg-border'}`} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">Hostel Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-xs text-foreground/80">Hostel Name *</Label>
                    <Input value={basic.name} onChange={e => setBasic(b => ({ ...b, name: e.target.value }))}
                      className="bg-background border-border text-foreground placeholder:text-muted-foreground h-10"
                      placeholder="e.g. Sunrise Men's Hostel" maxLength={120} />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-xs text-foreground/80">Full Address</Label>
                    <Input value={basic.address} onChange={e => setBasic(b => ({ ...b, address: e.target.value }))}
                      className="bg-background border-border text-foreground placeholder:text-muted-foreground h-10"
                      placeholder="Street, Area, Landmark" maxLength={500} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-foreground/80">City *</Label>
                    <Input value={basic.city} onChange={e => setBasic(b => ({ ...b, city: e.target.value }))}
                      className="bg-background border-border text-foreground placeholder:text-muted-foreground h-10" placeholder="Bangalore" maxLength={120} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-foreground/80">State</Label>
                    <Input value={basic.state} onChange={e => setBasic(b => ({ ...b, state: e.target.value }))}
                      className="bg-background border-border text-foreground placeholder:text-muted-foreground h-10" placeholder="Karnataka" maxLength={120} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-foreground/80">Contact Phone</Label>
                    <IndianMobileInput value={basic.phone} onChange={value => setBasic(b => ({ ...b, phone: value }))}
                      className="bg-background border-border" inputClassName="text-foreground placeholder:text-muted-foreground" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-foreground/80">Contact Email</Label>
                    <Input type="email" value={basic.email} onChange={e => setBasic(b => ({ ...b, email: e.target.value }))}
                      className="bg-background border-border text-foreground placeholder:text-muted-foreground h-10" placeholder="owner@example.com" maxLength={254} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-foreground/80">GSTIN (optional)</Label>
                    <Input value={basic.gstin} onChange={e => setBasic(b => ({ ...b, gstin: e.target.value.toUpperCase() }))}
                      className="bg-background border-border text-foreground placeholder:text-muted-foreground h-10" placeholder="15-character GSTIN" maxLength={15} />
                  </div>
                </div>
              </div>

              {/* Amenities */}
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">Features & Amenities</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {AMENITIES.map(am => (
                    <button key={am.id} type="button" onClick={() => toggleAmenity(am.id)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all text-xs font-medium ${
                        basic.amenities[am.id]
                          ? 'bg-indigo-600/20 border-indigo-500/60 text-indigo-600 dark:text-indigo-300'
                          : 'bg-secondary/50 border-border text-muted-foreground hover:border-muted-foreground'
                      }`}>
                      <am.icon className={`w-5 h-5 ${basic.amenities[am.id] ? 'text-indigo-500' : 'text-muted-foreground'}`} />
                      {am.label}
                      {basic.amenities[am.id] && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Food */}
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">Food & Meals</p>
                <div className="bg-secondary/50 border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Utensils className="w-4 h-4 text-orange-400" />
                      <span className="text-sm font-medium text-foreground">Mess / Kitchen Available</span>
                    </div>
                    <Switch checked={basic.food.mess_available} onCheckedChange={() => toggleFood('mess_available')} />
                  </div>
                  {basic.food.mess_available && (
                    <div className="space-y-3 pt-2 border-t border-border">
                      <div className="flex gap-2 flex-wrap">
                        {(['breakfast', 'lunch', 'dinner'] as const).map(k => (
                          <button key={k} type="button" onClick={() => toggleFood(k)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${
                              basic.food[k] ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' : 'bg-secondary border-border text-muted-foreground'
                            }`}>{k}</button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        {([['veg_only', '🥦 Veg Only'], ['non_veg', '🍗 Non-Veg']] as const).map(([k, l]) => (
                          <button key={k} type="button" onClick={() => toggleFood(k)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                              basic.food[k] ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-secondary border-border text-muted-foreground'
                            }`}>{l}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Additional Notes</Label>
                    <Textarea value={basic.food.food_notes}
                      onChange={e => setBasic(b => ({ ...b, food: { ...b.food, food_notes: e.target.value } }))}
                      className="bg-background border-border text-foreground placeholder:text-muted-foreground text-xs min-h-[50px] resize-none"
                      placeholder="Home-cooked food, special diet on request..." />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Global Controls */}
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-300">Building Configuration</p>
                <p className="text-xs text-muted-foreground">Choose your floor and room counts. No inventory is created until you submit this form.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Total Floors</Label>
                    <Input type="number" min={1} max={20} value={totalFloors}
                      onChange={e => handleTotalFloorsChange(parseInt(e.target.value) || 1)}
                      className="bg-background border-border text-foreground h-10 text-base font-bold" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Default Sharing</Label>
                    <Select value={defaultSharing} onValueChange={setDefaultSharing}>
                      <SelectTrigger className="bg-background border-border text-foreground h-10"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {SHARING_OPTIONS.filter(o => o.value !== 'custom').map(o => (
                          <SelectItem key={o.value} value={o.value} className="text-foreground">{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Default Rent (₹/month)</Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input type="number" min={0} step={500} value={defaultRent} onChange={e => setDefaultRent(e.target.value)}
                        className="bg-background border-border text-emerald-500 h-10 text-base font-bold pl-7" />
                    </div>
                  </div>
                  <div className="flex items-end">
                    <Button type="button" size="sm" onClick={applyDefaultsToAll}
                      className="w-full h-10 bg-secondary hover:bg-secondary/80 text-foreground text-xs">
                      Apply to All Rooms
                    </Button>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-2">
                {[['Floors', floors.length, 'text-indigo-400'], ['Rooms', totalRooms, 'text-blue-400'], ['Beds', totalBedsCount, 'text-emerald-400']].map(([l, v, c]) => (
                  <div key={l as string} className="bg-secondary/60 border border-border rounded-xl p-3 text-center">
                    <p className={`text-2xl font-black ${c}`}>{v}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{l}</p>
                  </div>
                ))}
              </div>

              {/* Per-Floor Room Builder */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">Per-Floor Room Configuration</p>
                {floors.map((floor, fi) => (
                  <div key={fi} className="border border-border rounded-xl overflow-hidden">
                    <button type="button" onClick={() => setExpandedFloor(expandedFloor === fi ? null : fi)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-secondary/80 hover:bg-secondary transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center">
                          <Layers className="w-3.5 h-3.5 text-indigo-400" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-foreground">Floor {floor.floorNumber}</p>
                          <p className="text-[10px] text-muted-foreground">{floor.rooms.length} rooms · {
                            floor.rooms.reduce((s, r) => s + (r.sharing === 'custom' ? parseInt(r.customSharing) || 0 : parseInt(r.sharing) || 0), 0)
                          } beds</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Rooms:</Label>
                          <Input type="number" min={0} max={50} value={floor.roomCount}
                            onChange={e => handleFloorRoomCount(fi, parseInt(e.target.value) || 0)}
                            className="w-16 h-7 bg-background border-border text-foreground text-xs text-center p-1" />
                        </div>
                        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expandedFloor === fi ? 'rotate-90' : ''}`} />
                      </div>
                    </button>

                    {expandedFloor === fi && (
                      <div className="p-3 space-y-2 bg-background/50">
                        <div className="grid grid-cols-12 gap-1 px-1 mb-1">
                          {['Room No.', 'Sharing Type', 'Rent (₹/mo)', 'Beds'].map(h => (
                            <p key={h} className={`text-[9px] text-muted-foreground uppercase tracking-wider ${h === 'Room No.' ? 'col-span-3' : h === 'Beds' ? 'col-span-1' : 'col-span-4'}`}>{h}</p>
                          ))}
                        </div>
                        {floor.rooms.map((room, ri) => (
                          <div key={ri} className="grid grid-cols-12 gap-1 items-center">
                            <Input value={room.roomNumber} onChange={e => handleRoomField(fi, ri, 'roomNumber', e.target.value)} maxLength={30}
                              className="col-span-3 h-8 bg-secondary border-border text-foreground text-xs px-2 font-mono" />
                            <div className="col-span-4">
                              <Select value={room.sharing} onValueChange={v => handleRoomField(fi, ri, 'sharing', v)}>
                                <SelectTrigger className="h-8 bg-background border-border text-foreground text-xs px-2"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                  {SHARING_OPTIONS.map(o => (
                                    <SelectItem key={o.value} value={o.value} className="text-foreground text-xs">{o.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-4 relative">
                              {room.sharing === 'custom' ? (
                                <Input type="number" min={1} max={10} value={room.customSharing}
                                  onChange={e => handleRoomField(fi, ri, 'customSharing', e.target.value)}
                                  placeholder="# beds"
                                  className="h-8 bg-background border-border text-foreground text-xs px-2" />
                              ) : (
                                <>
                                  <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                  <Input type="number" min={0} max={10000000} value={room.rent}
                                    onChange={e => handleRoomField(fi, ri, 'rent', e.target.value)}
                                    className="h-8 bg-secondary border-border text-emerald-600 dark:text-emerald-400 text-xs pl-5 font-semibold" />
                                </>
                              )}
                            </div>
                            <div className="col-span-1 flex justify-center">
                              <Badge variant="outline" className="text-[9px] border-border text-muted-foreground px-1">
                                {room.sharing === 'custom' ? (room.customSharing || '?') : room.sharing}B
                              </Badge>
                            </div>
                          </div>
                        ))}
                        {/* Rent row for custom sharing rooms */}
                        {floor.rooms.some(r => r.sharing === 'custom') && (
                          <div className="space-y-1 pt-1 border-t border-border/50">
                            {floor.rooms.filter(r => r.sharing === 'custom').map((room, customIdx) => {
                              const ri = floor.rooms.findIndex(r => r === room);
                              return (
                                <div key={customIdx} className="grid grid-cols-12 gap-1 items-center">
                                  <p className="col-span-3 text-[10px] text-muted-foreground font-mono px-2">{room.roomNumber}</p>
                                  <p className="col-span-4 text-[10px] text-muted-foreground">Rent:</p>
                                  <div className="col-span-4 relative">
                                    <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                    <Input type="number" min={0} max={10000000} value={room.rent}
                                      onChange={e => handleRoomField(fi, ri, 'rent', e.target.value)}
                                      className="h-8 bg-secondary border-border text-emerald-600 dark:text-emerald-400 text-xs pl-5 font-semibold" />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-700 dark:text-amber-200 flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Click on any floor to expand and customize each room&apos;s number, sharing type, and rent individually.</span>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="text-center py-4 space-y-2">
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-4">
                  <CreditCard className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">Choose how to pay</h3>
                <p className="text-muted-foreground text-sm">
                  Review <span className="text-foreground font-semibold">{basic.name}</span> with {totalRooms} rooms and {totalBedsCount} beds. Choose automatic renewal or pay once and renew manually.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  aria-pressed={billingMode === 'ONE_TIME'}
                  onClick={() => setBillingMode('ONE_TIME')}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    billingMode === 'ONE_TIME'
                      ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500'
                      : 'border-border bg-secondary/40 hover:bg-secondary/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-foreground">Pay once</h4>
                      <p className="mt-1 text-xs text-muted-foreground">No autopay or saved mandate</p>
                    </div>
                    <CreditCard className="h-5 w-5 shrink-0 text-indigo-500" />
                  </div>
                  <p className="mt-4 text-2xl font-black text-foreground">
                    ₹{HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_INR.toLocaleString('en-IN')}
                    <span className="text-xs font-medium text-muted-foreground"> / 30 days</span>
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Pay now using the payment methods available in Razorpay. Renew manually after 30 days to keep services active.
                  </p>
                </button>
                <button
                  type="button"
                  aria-pressed={billingMode === 'AUTO_PAY'}
                  onClick={() => setBillingMode('AUTO_PAY')}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    billingMode === 'AUTO_PAY'
                      ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500'
                      : 'border-border bg-secondary/40 hover:bg-secondary/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-foreground">Enable autopay</h4>
                      <p className="mt-1 text-xs text-muted-foreground">Recurring monthly subscription</p>
                    </div>
                    <CalendarDays className="h-5 w-5 shrink-0 text-indigo-500" />
                  </div>
                  <p className="mt-4 text-2xl font-black text-foreground">
                    ₹{HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_INR.toLocaleString('en-IN')}
                    <span className="text-xs font-medium text-muted-foreground"> / month</span>
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Start with a {HOSTEL_SUBSCRIPTION_TRIAL_DAYS}-day free trial, then Razorpay bills monthly using a supported mandate method.
                  </p>
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                One-time checkout offers the standard payment methods enabled for your Razorpay account. Autopay availability depends on the bank or mandate methods supported by Razorpay for your customer.
              </p>

              <div className="bg-secondary/40 border border-border rounded-xl p-4 space-y-2 text-sm">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Hostel setup summary</p>
                {[
                  ['Hostel', basic.name || '—'],
                  ['Location', [basic.city, basic.state].filter(Boolean).join(', ') || '—'],
                  ['Floors', String(floors.length)],
                  ['Total Rooms', String(totalRooms)],
                  ['Total Beds', String(totalBedsCount)],
                  ['Amenities', Object.entries(basic.amenities).filter(([, v]) => v).length + ' selected'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted-foreground">{k}</span>
                    <span className={`font-semibold ${k === 'Total Beds' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-4 border-t border-border bg-card/80 flex flex-row justify-between items-center gap-2 shrink-0">
          <Button variant="ghost" onClick={() => step > 1 ? setStep(s => s - 1) : onOpenChange(false)}
            disabled={loading} className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-4 h-4 mr-1" />{step === 1 ? 'Cancel' : 'Back'}
          </Button>
          {step < 3 ? (
            <Button onClick={handleNext} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6">
              Next Step <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleCompleteSetup} disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 shadow-lg shadow-emerald-600/20">
              {loading
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Opening secure checkout...</>
                : paymentAuthorization.current
                  ? <><ShieldCheck className="w-4 h-4 mr-2" />Retry hostel setup</>
                  : <><CreditCard className="w-4 h-4 mr-2" />{billingMode === 'AUTO_PAY'
                    ? `${resumeDraft ? 'Continue with autopay' : 'Start free trial'}`
                    : `${resumeDraft ? 'Continue with one-time payment' : 'Pay once & continue'}`}</>}
            </Button>
          )}
        </DialogFooter>
        </> : (
          <div className="relative py-2 text-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close payment status"
              onClick={() => paymentState === 'success' ? finishSuccess() : onOpenChange(false)}
              className="absolute -right-3 -top-4 h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
            <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
              paymentState === 'success' ? 'bg-emerald-500/10' :
              paymentState === 'failed' ? 'bg-rose-500/10' : 'bg-amber-500/10'
            }`}>
              {paymentState === 'success'
                ? <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                : paymentState === 'failed'
                  ? <XCircle className="h-7 w-7 text-rose-500" />
                  : <Clock3 className="h-7 w-7 text-amber-500" />}
            </div>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-center">
                {paymentState === 'success'
                  ? 'Payment successful'
                  : paymentState === 'failed'
                    ? 'Payment failed'
                    : paymentState === 'setup_failed'
                      ? 'Payment authorization needs attention'
                      : 'Payment still in progress'}
              </DialogTitle>
              <DialogDescription className="mt-2 text-sm text-center">
                {paymentState === 'success'
                  ? `Hostel created successfully. ${paymentMessage}`
                  : paymentMessage}
              </DialogDescription>
            </DialogHeader>
            {paymentState === 'success' ? (
              <Button onClick={finishSuccess} className="mt-6 w-full bg-emerald-600 text-white hover:bg-emerald-500">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Done
              </Button>
            ) : (
              <div className="mt-6 grid gap-2">
                <Button onClick={continuePayment} disabled={loading} className="w-full bg-indigo-600 text-white hover:bg-indigo-500">
                  {loading
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Connecting to payment...</>
                    : paymentAuthorization.current
                      ? 'Retry hostel setup'
                      : paymentState === 'failed'
                        ? 'Retry payment'
                        : `Continue payment for ${basic.name}`}
                </Button>
                <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading} className="w-full">
                  Save and go to dashboard
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
