'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { getMarketingUrl, getPortalUrl } from '@/lib/portal-urls';
import { Building2, Loader2, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';

export default function LoginClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [homeHref, setHomeHref] = useState('/');
  const [adminHref, setAdminHref] = useState('/admin/login');

  useEffect(() => {
    const hostname = window.location.hostname.toLowerCase();
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
    setHomeHref(isLocal ? '/' : getMarketingUrl('/'));
    setAdminHref(isLocal ? '/admin/login' : getPortalUrl('admin', '/'));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast({
        title: 'Sign in failed',
        description: error.message,
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    toast({ title: 'Welcome back!', description: 'Redirecting to your dashboard...' });
    setLoading(false);
    router.push('/auth/callback');
  }

  async function signInWithGoogle() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      toast({ title: 'Google sign in failed', description: error.message, variant: 'destructive' });
      setLoading(false);
    }
  }

  return (
    <main className="flex h-dvh min-h-[520px] items-center justify-center overflow-hidden bg-[#f7f8fb] px-4 py-3 text-slate-900">
      <div className="w-full max-w-[420px]">
        <div className="mb-3 flex items-center justify-between">
          <Link href={homeHref} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-slate-950">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <span className="text-xs font-medium text-slate-400">HOSTEL MANAGER</span>
        </div>

        <Card className="border border-slate-200/80 bg-white shadow-[0_18px_55px_-28px_rgba(15,23,42,0.24)]">
          <CardHeader className="space-y-1 pb-4 pt-5">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-bold tracking-tight text-slate-950">Kupera</p>
                <p className="text-xs text-slate-500">Hostel &amp; PG management</p>
              </div>
            </div>
            <CardTitle className="text-xl font-semibold text-slate-950">Welcome back</CardTitle>
            <CardDescription className="text-sm text-slate-500">Sign in to manage your property.</CardDescription>
          </CardHeader>

          <div className="px-6">
            <Button type="button" variant="outline" className="h-11 w-full border-slate-300 bg-white font-medium text-slate-800 hover:bg-slate-50" disabled={loading} onClick={() => void signInWithGoogle()}>
              <GoogleMark />
              Continue with Google
            </Button>
            <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              or continue with
              <span className="h-px flex-1 bg-slate-200" />
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-3 pb-3">
              <div className="space-y-1.5">
                <Label htmlFor="login-email" className="text-sm font-medium text-slate-700">Email address</Label>
                <Input id="login-email" type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} className="h-10 border-slate-300 bg-white text-slate-900 placeholder:text-slate-400" autoComplete="email" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password" className="text-sm font-medium text-slate-700">Password</Label>
                <div className="relative">
                  <Input id="login-password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-10 border-slate-300 bg-white pr-10 text-slate-900 placeholder:text-slate-400" autoComplete="current-password" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 pt-1">
              <Button id="login-submit" type="submit" className="h-10 w-full bg-indigo-600 font-semibold text-white hover:bg-indigo-700" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
              <p className="text-center text-sm text-slate-500">
                New to Kupera? <Link href="/signup" className="font-semibold text-indigo-600 hover:text-indigo-700">Create an account</Link>
              </p>
            </CardFooter>
          </form>
        </Card>

        <div className="mt-3 flex items-center justify-between px-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-slate-400" /> Secure sign in</span>
          <a href={adminHref} className="font-medium text-slate-600 hover:text-indigo-700">Super admin →</a>
        </div>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="mr-2 h-4 w-4">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.75 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.28-1.93-6.15-4.53H2.16v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.85 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.16a11 11 0 0 0 0 9.9l3.69-2.84Z" />
      <path fill="#EA4335" d="M12 4.36c1.62 0 3.06.56 4.2 1.65l3.15-3.15C17.46 1.09 14.97 0 12 0a11 11 0 0 0-9.84 7.05l3.69 2.84c.87-2.6 3.29-5.53 6.15-5.53Z" />
    </svg>
  );
}
