'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { getMarketingUrl } from '@/lib/portal-urls';
import { ShieldAlert, Loader2, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';

export default function SuperAdminLoginClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [homeHref, setHomeHref] = useState('/');

  useEffect(() => {
    const hostname = window.location.hostname.toLowerCase();
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
    setHomeHref(isLocal ? '/' : getMarketingUrl('/'));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      toast({
        title: 'Sign in failed',
        description: error.message,
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    // Verify the signed-in user actually has super_admin role
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role, active')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError || !profileData) {
      await supabase.auth.signOut();
      toast({
        title: 'Access denied',
        description: 'Unable to verify your account. Please contact support.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    if (profileData.role !== 'super_admin' || !profileData.active) {
      await supabase.auth.signOut();
      toast({
        title: 'Access denied',
        description: 'This account does not have an active super-admin profile. Ask your project administrator to grant it the super_admin role.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    toast({
      title: '✅ Welcome, Super Admin!',
      description: 'Redirecting to the Command Center…',
    });
    setLoading(false);
    router.push('/admin/dashboard');
  }

  return (
    <main className="flex h-dvh min-h-[500px] items-center justify-center overflow-hidden bg-[#f7f8fb] px-4 py-3 text-slate-900">
      <div className="w-full max-w-[420px]">
        <div className="mb-3 flex items-center justify-between">
          <Link href={homeHref} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-slate-950">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <span className="text-xs font-medium text-slate-400">ADMIN PORTAL</span>
        </div>

        <Card className="border border-slate-200/80 bg-white shadow-[0_18px_55px_-28px_rgba(15,23,42,0.24)]">
          <CardHeader className="space-y-1 pb-4 pt-5">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-bold tracking-tight text-slate-950">Kupera</p>
                <p className="text-xs text-slate-500">Platform administration</p>
              </div>
            </div>
            <CardTitle className="text-xl font-semibold text-slate-950">Administrator sign in</CardTitle>
            <CardDescription className="text-sm text-slate-500">Use an account with an active super-admin role.</CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-3 pb-3">
              <div className="space-y-1.5">
                <Label htmlFor="superadmin-email" className="text-sm font-medium text-slate-700">Email address</Label>
                <Input
                  id="superadmin-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Super-admin email address"
                  className="h-10 border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                  autoComplete="username"
                  maxLength={254}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="superadmin-password" className="text-sm font-medium text-slate-700">Password</Label>
                <div className="relative">
                  <Input id="superadmin-password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-10 border-slate-300 bg-white pr-10 text-slate-900 placeholder:text-slate-400" autoComplete="current-password" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 pt-1">
              <Button id="superadmin-login-submit" type="submit" className="h-10 w-full bg-indigo-600 font-semibold text-white hover:bg-indigo-700" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Verifying access…' : 'Sign in'}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <Lock className="h-3.5 w-3.5 text-slate-400" /> Protected administrator access
        </p>
      </div>
    </main>
  );
}
