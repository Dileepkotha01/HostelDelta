import { AlertCircle, Building } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface OwnerBankSetupProps {
  hostelId: string;
}

export function OwnerBankSetup({ hostelId: _hostelId }: OwnerBankSetupProps) {
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2 text-white">
          <Building className="h-5 w-5 text-indigo-400" />
          Rent Payout Setup
        </CardTitle>
        <CardDescription className="text-slate-400">
          Secure online rent collection is not enabled for this hostel yet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-3 flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-200">
            Do not enter or send bank details here. Verified Razorpay Route onboarding must be completed before payouts can be enabled.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
