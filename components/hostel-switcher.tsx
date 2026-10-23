'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, PlusCircle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { OnboardHostelWizard } from '@/components/OnboardHostelWizard';

export function HostelSwitcher() {
  const { profile, switchHostel } = useAuth();
  const { toast } = useToast();
  const [hostels, setHostels] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Create hostel modal state
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const loadHostels = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('hostels')
      .select('id, name')
      .eq('owner_id', profile.id)
      .order('created_at', { ascending: true });
    
    setHostels(data || []);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    if (profile?.id) void loadHostels();
  }, [profile?.id, profile?.hostel_id, loadHostels]);

  async function handleSwitch(value: string) {
    if (value === 'create_new') {
      setIsWizardOpen(true);
      return;
    }
    
    if (value !== profile?.hostel_id) {
      await switchHostel(value);
      toast({ title: 'Switched hostel ✅' });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-bold text-sm hidden lg:block">HostelHub</span>
      </div>
    );
  }

  if (hostels.length === 0) {
    return (
      <>
        <Button onClick={() => setIsWizardOpen(true)} className="gap-2 bg-primary/10 text-primary hover:bg-primary/20">
          <PlusCircle className="w-4 h-4" /> Add Hostel
        </Button>
        {profile?.id && (
          <OnboardHostelWizard 
            open={isWizardOpen} 
            onOpenChange={setIsWizardOpen} 
            userId={profile.id} 
            onSuccess={async (hostelId) => {
              await switchHostel(hostelId);
              await loadHostels();
              router.push('/app/dashboard');
            }} 
          />
        )}
      </>
    );
  }

  return (
    <>
      <Select value={profile?.hostel_id || undefined} onValueChange={handleSwitch}>
        <SelectTrigger className="w-[180px] bg-secondary/50 border-none shadow-sm focus:ring-1 focus:ring-primary h-9">
          <div className="flex items-center gap-2 truncate">
            <Building2 className="w-4 h-4 text-primary shrink-0" />
            <span className="font-semibold truncate">
              {hostels.find(h => h.id === profile?.hostel_id)?.name || 'Select Hostel'}
            </span>
          </div>
        </SelectTrigger>
        <SelectContent>
          {hostels.map(h => (
            <SelectItem key={h.id} value={h.id}>
              {h.name}
            </SelectItem>
          ))}
          <div className="h-px bg-border my-1" />
          <SelectItem value="create_new" className="text-primary font-medium focus:bg-primary/10 focus:text-primary cursor-pointer">
            <div className="flex items-center gap-2">
              <PlusCircle className="w-4 h-4" /> Add Another Hostel
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      {profile?.id && (
        <OnboardHostelWizard 
          open={isWizardOpen} 
          onOpenChange={setIsWizardOpen} 
          userId={profile.id} 
          onSuccess={async (hostelId) => {
            await switchHostel(hostelId);
            await loadHostels();
            router.push('/app/dashboard');
          }} 
        />
      )}
    </>
  );
}
