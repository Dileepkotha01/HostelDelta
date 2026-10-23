'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  DoorOpen,
  IndianRupee,
  Check,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Plus,
  BedDouble,
  Sparkles,
} from 'lucide-react';
import type { Floor, RoomType, RoomStatus } from '@/lib/types';

interface AddRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hostelId: string | null;
  floors: Floor[];
  onSuccess?: () => void;
  onOpenAddFloor?: () => void;
}

export function AddRoomDialog({
  open,
  onOpenChange,
  hostelId,
  floors,
  onSuccess,
  onOpenAddFloor,
}: AddRoomDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [roomNumber, setRoomNumber] = useState('');
  const [floorId, setFloorId] = useState<string>('');
  const [roomType, setRoomType] = useState<RoomType>('double');
  const [capacity, setCapacity] = useState<number>(2);
  const [monthlyRent, setMonthlyRent] = useState<string>('');
  const [status, setStatus] = useState<RoomStatus>('vacant');

  // Pre-select first floor if available
  useEffect(() => {
    if (floors.length > 0 && !floorId) {
      setFloorId(floors[0].id);
    }
  }, [floors, floorId]);

  // Adjust capacity suggestion when room type changes (user can still override)
  function handleRoomTypeChange(type: RoomType) {
    setRoomType(type);
    if (type === 'single') setCapacity(1);
    else if (type === 'double') setCapacity(2);
    else if (type === 'triple') setCapacity(3);
    else setCapacity(4);
  }

  function resetForm() {
    setRoomNumber('');
    setFloorId(floors[0]?.id || '');
    setRoomType('double');
    setCapacity(2);
    setMonthlyRent('');
    setStatus('vacant');
    setStep(1);
  }

  function handleClose(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) resetForm();
  }

  function validateStep1(): boolean {
    if (!roomNumber.trim()) {
      toast({ title: 'Room number is required', description: 'e.g. 101, 204, G-01', variant: 'destructive' });
      return false;
    }
    if (!floorId && floors.length > 0) {
      toast({ title: 'Please select a floor', variant: 'destructive' });
      return false;
    }
    return true;
  }

  function handleNext() {
    if (validateStep1()) setStep(2);
  }

  async function handleCreateRoom() {
    if (!hostelId) {
      toast({ title: 'No hostel selected', variant: 'destructive' });
      return;
    }

    const rentNum = parseFloat(monthlyRent) || 0;
    if (rentNum <= 0) {
      toast({ title: 'Monthly rent must be greater than 0', variant: 'destructive' });
      return;
    }
    if (capacity < 1) {
      toast({ title: 'Capacity must be at least 1', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      // 1. Insert Room
      const { data: newRoom, error: roomError } = await supabase
        .from('rooms')
        .insert({
          hostel_id: hostelId,
          floor_id: floorId || null,
          room_number: roomNumber.trim(),
          room_type: roomType,
          capacity: capacity,
          monthly_rent: rentNum,
          status: status,
        })
        .select()
        .single();

      if (roomError) {
        if (roomError.code === '23505') {
          throw new Error(`Room #${roomNumber} already exists in this hostel.`);
        }
        throw roomError;
      }

      // 2. Generate Beds for Room
      const bedLabels = Array.from({ length: Math.min(capacity, 10) }, (_, i) =>
        String.fromCharCode(65 + i)
      );
      const bedsToInsert = bedLabels.map((label) => ({
        room_id: newRoom.id,
        bed_label: `Bed ${label}`,
        status: status === 'maintenance' ? 'maintenance' : 'vacant',
      }));

      const { error: bedsError } = await supabase.from('beds').insert(bedsToInsert);
      if (bedsError) {
        console.error('Beds creation notice:', bedsError);
      }

      toast({
        title: `Room #${roomNumber} created! 🎉`,
        description: `Added with ${capacity} bed${capacity > 1 ? 's' : ''} at ₹${rentNum.toLocaleString('en-IN')}/mo.`,
      });

      handleClose(false);
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create room';
      toast({ title: 'Creation failed', description: message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  const stepsMeta = [
    { s: 1, label: 'Configuration', sub: 'Number & Floor' },
    { s: 2, label: 'Rent & Beds', sub: 'Pricing & Capacity' },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-24px)] sm:w-full max-w-lg max-h-[92vh] flex flex-col p-0 overflow-hidden bg-card border-border rounded-2xl sm:rounded-3xl shadow-2xl">
        {/* Header with Centered Stepper */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 sm:p-6 pb-3 sm:pb-5 border-b shrink-0">
          <DialogHeader className="text-center sm:text-left">
            <DialogTitle className="text-lg sm:text-2xl font-bold flex items-center justify-center sm:justify-start gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm shadow-primary/20 shrink-0">
                <DoorOpen className="w-4 h-4" />
              </div>
              <span>Add New Room</span>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
              Create a room, assign it to a floor, and automatically provision its beds.
            </DialogDescription>
          </DialogHeader>

          {/* Stepper Progress Bar */}
          <div className="mt-4 px-2">
            <div className="flex items-center justify-between max-w-xs mx-auto">
              {stepsMeta.map(({ s, label, sub }, idx) => {
                const isCompleted = step > s;
                const isActive = step === s;
                return (
                  <div key={s} className="flex-1 flex flex-col items-center">
                    <div className="flex items-center w-full">
                      <div
                        className={`h-0.5 sm:h-1 flex-1 transition-all ${
                          idx === 0
                            ? 'invisible'
                            : isCompleted || isActive
                            ? 'bg-primary'
                            : 'bg-muted-foreground/20'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (s < step) setStep(s);
                        }}
                        disabled={s > step}
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                          isCompleted
                            ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                            : isActive
                            ? 'bg-primary text-primary-foreground ring-4 ring-primary/20 shadow-md shadow-primary/30 scale-105'
                            : 'bg-secondary text-muted-foreground border border-border'
                        }`}
                      >
                        {isCompleted ? <Check className="w-4 h-4 stroke-[2.5]" /> : s}
                      </button>
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
                    <div className="mt-1.5 text-center flex flex-col items-center">
                      <span className={`text-[11px] font-bold ${isActive ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {label}
                      </span>
                      <span className="text-[9px] text-muted-foreground hidden sm:block">
                        {sub}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content Body — NOT a form, just a div */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 no-scrollbar">

            {/* Step 1: Configuration */}
            {step === 1 && (
              <div className="space-y-4 animate-fade-in">
                <div className="space-y-1.5">
                  <Label htmlFor="room-no" className="text-xs sm:text-sm font-semibold">
                    Room Number / Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="room-no"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleNext(); } }}
                    placeholder="e.g. 101, 204, G-01"
                    className="h-10 text-sm rounded-xl font-medium"
                    autoFocus
                  />
                  <p className="text-[11px] text-muted-foreground">Unique identifier displayed to residents and staff.</p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="room-floor" className="text-xs sm:text-sm font-semibold">
                      Assigned Floor
                    </Label>
                    {onOpenAddFloor && (
                      <button
                        type="button"
                        onClick={() => {
                          handleClose(false);
                          onOpenAddFloor();
                        }}
                        className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> New Floor
                      </button>
                    )}
                  </div>
                  {floors.length === 0 ? (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
                      No floors created yet. You can create a floor first or proceed without a floor assignment.
                    </div>
                  ) : (
                    <Select value={floorId} onValueChange={setFloorId}>
                      <SelectTrigger id="room-floor" className="h-10 text-sm rounded-xl">
                        <SelectValue placeholder="Select a floor" />
                      </SelectTrigger>
                      <SelectContent>
                        {floors.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            Floor {f.floor_number} {f.name ? `— ${f.name}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="room-type" className="text-xs sm:text-sm font-semibold">
                    Room Type
                  </Label>
                  <Select value={roomType} onValueChange={(val) => handleRoomTypeChange(val as RoomType)}>
                    <SelectTrigger id="room-type" className="h-10 text-sm rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single Sharing (1 Bed)</SelectItem>
                      <SelectItem value="double">Double Sharing (2 Beds)</SelectItem>
                      <SelectItem value="triple">Triple Sharing (3 Beds)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 2: Rent & Beds Setup */}
            {step === 2 && (
              <div className="space-y-4 animate-fade-in">
                <div className="space-y-1.5">
                  <Label htmlFor="room-rent" className="text-xs sm:text-sm font-semibold">
                    Monthly Rent per Bed (₹) <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <IndianRupee className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="room-rent"
                      type="number"
                      value={monthlyRent}
                      onChange={(e) => setMonthlyRent(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                      placeholder="e.g. 6500"
                      className="pl-9 h-10 text-sm rounded-xl font-semibold"
                      autoFocus
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Standard monthly charge per resident for this room.</p>
                </div>

                {/* Editable Capacity */}
                <div className="space-y-1.5">
                  <Label htmlFor="room-capacity" className="text-xs sm:text-sm font-semibold">
                    Bed Capacity
                  </Label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCapacity(Math.max(1, capacity - 1))}
                      className="w-10 h-10 rounded-xl border border-border bg-secondary hover:bg-muted flex items-center justify-center text-lg font-bold transition-colors"
                    >
                      −
                    </button>
                    <Input
                      id="room-capacity"
                      type="number"
                      min="1"
                      max="10"
                      value={capacity}
                      onChange={(e) => setCapacity(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                      className="h-10 text-sm rounded-xl font-bold text-center w-20"
                    />
                    <button
                      type="button"
                      onClick={() => setCapacity(Math.min(10, capacity + 1))}
                      className="w-10 h-10 rounded-xl border border-border bg-secondary hover:bg-muted flex items-center justify-center text-lg font-bold transition-colors"
                    >
                      +
                    </button>
                    <span className="text-sm text-muted-foreground">beds</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Number of beds to auto-generate. Can differ from room type suggestion.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="room-status" className="text-xs sm:text-sm font-semibold">
                    Initial Status
                  </Label>
                  <Select value={status} onValueChange={(val) => setStatus(val as RoomStatus)}>
                    <SelectTrigger id="room-status" className="h-10 text-sm rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vacant">Vacant (Ready for occupancy)</SelectItem>
                      <SelectItem value="maintenance">Maintenance (Under repair / cleaning)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Automatic Bed Generation Preview */}
                <div className="p-3.5 rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Auto-Generated Beds ({capacity})</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {Array.from({ length: Math.min(capacity, 10) }, (_, i) => String.fromCharCode(65 + i)).map((letter) => (
                      <div
                        key={letter}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border text-xs font-semibold shadow-xs"
                      >
                        <BedDouble className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Bed {letter}</span>
                        <span className="text-[10px] text-muted-foreground ml-1">({status})</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Beds are automatically registered and can immediately be allocated when onboarding tenants.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="p-4 sm:px-6 border-t shrink-0 flex items-center justify-between bg-card/90 backdrop-blur-sm">
            {step > 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(step - 1)}
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

            {step < 2 ? (
              <Button
                type="button"
                onClick={handleNext}
                className="h-9 sm:h-10 text-xs sm:text-sm rounded-xl px-4 sm:px-6 shadow-md shadow-primary/20"
              >
                Next <ChevronRight className="w-4 h-4 ml-1.5" />
              </Button>
            ) : (
              <Button
                type="button"
                disabled={submitting}
                onClick={handleCreateRoom}
                className="h-9 sm:h-10 text-xs sm:text-sm rounded-xl px-4 sm:px-6 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating Room...
                  </>
                ) : (
                  'Create Room & Beds'
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
