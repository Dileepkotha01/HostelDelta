'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Home, Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { OnboardHostelWizard } from '@/components/OnboardHostelWizard';
import { useRouter } from 'next/navigation';

export function NoHostelLinked() {
  const { profile, switchHostel } = useAuth();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const canAddHostel = profile?.role === 'hostel_owner' || profile?.role === 'super_admin';

  return (
    <>
      <Card className="border-dashed bg-slate-900/50">
        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-6">
            <Home className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-2xl font-bold mb-2 text-white">Welcome to Hostelhood</h3>
          
          {canAddHostel ? (
            <>
              <p className="text-slate-400 mb-8 max-w-md">
                It looks like you haven&apos;t set up your hostel property yet. Get started by defining your inventory and settings.
              </p>
              <Button onClick={() => setOpen(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 px-8 py-6 text-lg rounded-xl">
                <Plus className="w-5 h-5 mr-2" /> Add Your Hostel
              </Button>
            </>
          ) : (
            <p className="text-sm text-slate-400 mb-6 max-w-md">
              Your account is not linked to a hostel yet. Please contact your administrator to be assigned to a hostel property.
            </p>
          )}
        </CardContent>
      </Card>

      {profile && (
        <OnboardHostelWizard 
          open={open} 
          onOpenChange={setOpen} 
          userId={profile.id} 
          onSuccess={async (hostelId) => {
            await switchHostel(hostelId);
            router.replace('/app/dashboard');
          }}
        />
      )}
    </>
  );
}
