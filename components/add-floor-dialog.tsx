'use client';

import { useState, useEffect, FormEvent } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Layers,
  Building2,
  DoorOpen,
  IndianRupee,
  Loader2,
  Sparkles,
} from 'lucide-react';
import type { Floor } from '@/lib/types';

interface AddFloorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hostelId: string | null;
  existingFloors: Floor[];
  onSuccess?: () => void;
}

export function AddFloorDialog({
  open,
  onOpenChange,
  hostelId,
  existingFloors,
  onSuccess,
}: AddFloorDialogProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // Compute next floor number recommendation
  const nextFloorNumber = existingFloors.length > 0
    ? Math.max(...existingFloors.map((f) => f.floor_number)) + 1
    : 1;

  const [floorNumber, setFloorNumber] = useState<string>(String(nextFloorNumber));
  const [floorName, setFloorName] = useState<string>('');

  // Quick room generation options
  const [autoGenRooms, setAutoGenRooms] = useState(false);
  const [roomCount, setRoomCount] = useState<number>(4);
  const [defaultRent, setDefaultRent] = useState<string>('6500');

  useEffect(() => {
    if (open) {
      const nextNum = existingFloors.length > 0
        ? Math.max(...existingFloors.map((f) => f.floor_number)) + 1
        : 1;
      setFloorNumber(String(nextNum));
      setFloorName(nextNum === 0 ? 'Ground Floor' : `Floor ${nextNum}`);
      setAutoGenRooms(false);
    }
  }, [open, existingFloors]);

  function handleClose(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setFloorName('');
      setAutoGenRooms(false);
    }
  }

  async function handleCreateFloor(e: FormEvent) {
    e.preventDefault();
    if (!hostelId) {
      toast({ title: 'No hostel selected', variant: 'destructive' });
      return;
    }

    const num = parseInt(floorNumber, 10);
    if (isNaN(num)) {
      toast({ title: 'Invalid floor number', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      // 1. Insert Floor
      const { data: newFloor, error: floorError } = await supabase
        .from('floors')
        .insert({
          hostel_id: hostelId,
          floor_number: num,
          name: floorName.trim() || `Floor ${num}`,
        })
        .select()
        .single();

      if (floorError) {
        if (floorError.code === '23505') {
          throw new Error(`Floor number ${num} already exists in this hostel.`);
        }
        throw floorError;
      }

      // 2. Optional: Auto-generate rooms and beds for this floor
      if (autoGenRooms && roomCount > 0 && newFloor) {
        const rentNum = parseFloat(defaultRent) || 6500;
        const prefix = num === 0 ? 'G' : String(num);

        for (let i = 1; i <= roomCount; i++) {
          const roomNumberStr = `${prefix}${String(i).padStart(2, '0')}`; // e.g. 101, 102 or G01, G02
          const { data: createdRoom } = await supabase
            .from('rooms')
            .insert({
              hostel_id: hostelId,
              floor_id: newFloor.id,
              room_number: roomNumberStr,
              room_type: 'double',
              capacity: 2,
              monthly_rent: rentNum,
              status: 'vacant',
            })
            .select()
            .single();

          if (createdRoom) {
            await supabase.from('beds').insert([
              { room_id: createdRoom.id, bed_label: 'Bed A', status: 'vacant' },
              { room_id: createdRoom.id, bed_label: 'Bed B', status: 'vacant' },
            ]);
          }
        }
      }

      // 3. Update hostel total_floors count
      const totalFloorsCount = Math.max(existingFloors.length + 1, num);
      await supabase
        .from('hostels')
        .update({ total_floors: totalFloorsCount })
        .eq('id', hostelId);

      toast({
        title: `Floor ${num} added! 🏢`,
        description: autoGenRooms
          ? `Created Floor ${num} with ${roomCount} double-sharing rooms.`
          : `Floor ${num} (${floorName || `Floor ${num}`}) is ready.`,
      });

      handleClose(false);
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add floor';
      toast({ title: 'Error adding floor', description: message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-24px)] sm:w-full max-w-md max-h-[92vh] flex flex-col p-0 overflow-hidden bg-card border-border rounded-2xl sm:rounded-3xl shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 sm:p-6 pb-3 sm:pb-5 border-b shrink-0">
          <DialogHeader className="text-center sm:text-left">
            <DialogTitle className="text-lg sm:text-2xl font-bold flex items-center justify-center sm:justify-start gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm shadow-primary/20 shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <span>Add New Floor</span>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
              Organize your rooms by building levels and floors.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Form Body */}
        <form onSubmit={handleCreateFloor} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 no-scrollbar">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="floor-num" className="text-xs sm:text-sm font-semibold">
                  Floor Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="floor-num"
                  required
                  type="number"
                  value={floorNumber}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFloorNumber(val);
                    if (val === '0') setFloorName('Ground Floor');
                    else if (val) setFloorName(`Floor ${val}`);
                  }}
                  placeholder="1"
                  className="h-10 text-sm rounded-xl font-semibold"
                />
                <p className="text-[11px] text-muted-foreground">0 for Ground Floor, 1 for 1st Floor, etc.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="floor-name" className="text-xs sm:text-sm font-semibold">
                  Floor Name / Label
                </Label>
                <Input
                  id="floor-name"
                  value={floorName}
                  onChange={(e) => setFloorName(e.target.value)}
                  placeholder="e.g. 1st Floor, Terrace"
                  className="h-10 text-sm rounded-xl"
                />
                <p className="text-[11px] text-muted-foreground">Friendly display name.</p>
              </div>
            </div>

            {/* Quick Room Generation Toggle */}
            <div className="p-3.5 rounded-xl border bg-secondary/30 space-y-3 mt-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" /> Quick-Generate Rooms
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Automatically create starter rooms on this floor.
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="auto-gen-toggle"
                  checked={autoGenRooms}
                  onChange={(e) => setAutoGenRooms(e.target.checked)}
                  className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
                />
              </div>

              {autoGenRooms && (
                <div className="pt-2 border-t border-border/60 grid grid-cols-2 gap-3 animate-fade-in text-xs">
                  <div className="space-y-1">
                    <Label htmlFor="quick-count" className="text-[11px] font-medium">Number of Rooms</Label>
                    <Input
                      id="quick-count"
                      type="number"
                      min="1"
                      max="12"
                      value={roomCount}
                      onChange={(e) => setRoomCount(parseInt(e.target.value, 10) || 1)}
                      className="h-8 text-xs rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="quick-rent" className="text-[11px] font-medium">Rent per bed (₹)</Label>
                    <Input
                      id="quick-rent"
                      type="number"
                      value={defaultRent}
                      onChange={(e) => setDefaultRent(e.target.value)}
                      className="h-8 text-xs rounded-lg font-semibold"
                    />
                  </div>
                  <p className="col-span-2 text-[10px] text-muted-foreground">
                    Will generate rooms with 2 vacant beds each (e.g. {floorNumber === '0' ? 'G01-G' + String(roomCount).padStart(2, '0') : `${floorNumber}01-${floorNumber}` + String(roomCount).padStart(2, '0')}).
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer Controls */}
          <div className="p-4 sm:px-6 border-t shrink-0 flex items-center justify-between bg-card/90 backdrop-blur-sm">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleClose(false)}
              className="h-9 sm:h-10 text-xs sm:text-sm rounded-xl text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="h-9 sm:h-10 text-xs sm:text-sm rounded-xl px-4 sm:px-6 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Adding...
                </>
              ) : (
                'Add Floor'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
