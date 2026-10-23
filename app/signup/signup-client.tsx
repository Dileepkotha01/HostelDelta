'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Building2, Loader2, Lock, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import type { UserRole } from '@/lib/types';
import { getMarketingUrl } from '@/lib/portal-urls';
import { IndianMobileInput } from '@/components/ui/indian-mobile-input';
import { isValidIndianMobileNumber, toIndianMobileE164 } from '@/lib/indian-mobile';

const ROLES: { value: UserRole; label: string; description: string }[] = [
  { value: 'hostel_owner', label: 'Hostel Owner', description: 'Manage hostels, rooms, billing, and staff' },
  { value: 'caretaker', label: 'Caretaker / Warden', description: 'Mobile interface for daily operations' },
];

export default function SignupClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('hostel_owner');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [marketingUrl, setMarketingUrl] = useState('/');

  useEffect(() => {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.endsWith('.localhost')) {
      setMarketingUrl(getMarketingUrl('/'));
    }
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = fullName.trim();
    const normalizedPhone = toIndianMobileE164(phone);

    if (normalizedName.length < 2) {
      toast({ title: 'Enter your full name', description: 'Your name must contain at least 2 characters.', variant: 'destructive' });
      return;
    }
    if (!isValidIndianMobileNumber(phone)) {
      toast({ title: 'Enter a valid 10-digit Indian mobile number', description: 'The +91 country code is already selected.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    setConfirmationEmail('');

    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: normalizedName,
            role,
            phone: normalizedPhone,
          },
        },
      });

      if (error) {
        const message = `${error.message} ${error.code || ''}`.toLowerCase();
        if (error.status === 504 || error.status === 502 || error.status === 503) {
          setConfirmationEmail(normalizedEmail);
          toast({
            title: 'Supabase timed out while creating the account',
            description: `Supabase Auth returned HTTP ${error.status}. The request may have created a pending account before timing out. Check Authentication → Users and your email inbox before retrying; repeated signup attempts can create duplicate-account errors or hit the email limit. If no account appears, inspect Supabase Auth and Postgres logs.`,
            variant: 'destructive',
          });
        } else if (error.status === 429 || message.includes('rate limit') || message.includes('over_email_send_rate_limit')) {
          toast({
            title: 'Email sending limit reached',
            description: 'Supabase has temporarily limited confirmation emails. Check Authentication → Users for this address before retrying, then wait for the project email limit to reset. Supabase’s built-in email service has strict delivery limits.',
            variant: 'destructive',
          });
        } else if (message.includes('already registered') || message.includes('already been registered') || message.includes('user already exists')) {
          setConfirmationEmail(normalizedEmail);
          toast({
            title: 'This email may already have an account',
            description: 'Try signing in, or use the confirmation resend option if you have not confirmed the earlier signup. Check your inbox and spam folder.',
            variant: 'destructive',
          });
        } else if (message.includes('error sending confirmation email') || message.includes('smtp')) {
          toast({
            title: 'Supabase could not send the confirmation email',
            description: 'Check Supabase Auth email settings and logs. With custom SMTP disabled, confirmation delivery uses Supabase’s built-in email service, which has strict recipient and rate limits.',
            variant: 'destructive',
          });
        } else if (message.includes('database error saving new user') || message.includes('database error')) {
          toast({
            title: 'Supabase could not save the account',
            description: 'This usually means the database signup trigger failed. Check Supabase Logs → Postgres/Auth for the trigger error and verify the latest profile-provisioning migration was applied.',
            variant: 'destructive',
          });
        } else if (message.includes('password should be at least') || message.includes('password is too short')) {
          toast({
            title: 'Password is too short',
            description: 'Use at least 8 characters and meet any additional password rules configured in Supabase Auth.',
            variant: 'destructive',
          });
        } else {
          const diagnostic = [error.status ? `HTTP ${error.status}` : '', error.code || ''].filter(Boolean).join(' · ');
          toast({
            title: 'Sign up failed',
            description: diagnostic ? `${error.message} (${diagnostic})` : error.message,
            variant: 'destructive',
          });
        }
        return;
      }

      if (!data.user) {
        toast({
          title: 'Account was not created',
          description: 'Supabase did not return an account. Check your Supabase Auth configuration and try again later.',
          variant: 'destructive',
        });
        return;
      }

      if (!data.session) {
        setConfirmationEmail(normalizedEmail);
        toast({
          title: 'Email confirmation may be required',
          description: 'No signed-in session was returned. The address may belong to an unconfirmed or existing account. Check your email and avoid repeated signup attempts.',
        });
        return;
      }

      toast({
        title: 'Account created!',
        description: 'Welcome to HostelHub. Continue to set up your hostel.',
      });
      router.push('/auth/callback');
    } catch (error: unknown) {
      if (error instanceof Error && /fetch|network|timeout/i.test(`${error.name} ${error.message}`)) {
        setConfirmationEmail(normalizedEmail);
        toast({
          title: 'Signup result could not be confirmed',
          description: 'The connection failed while contacting Supabase. Check Authentication → Users and your email inbox before retrying, because the signup may have reached Supabase.',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Could not reach Supabase Auth',
        description: error instanceof Error ? error.message : 'Check your connection and Supabase configuration, then try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function resendConfirmation() {
    if (!confirmationEmail) return;

    setResendingConfirmation(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: confirmationEmail,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });

      if (error) {
        const rateLimited = error.status === 429 || error.message.toLowerCase().includes('rate limit');
        toast({
          title: rateLimited ? 'Email sending limit reached' : 'Could not resend confirmation',
          description: rateLimited
            ? 'Wait for Supabase’s email limit to reset. The built-in email service has strict delivery limits; avoid repeated resend attempts.'
            : error.message,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Confirmation request submitted',
        description: 'If the account can be confirmed, Supabase will send an email. Check your inbox and spam folder.',
      });
    } catch (error: unknown) {
      toast({
        title: 'Could not reach Supabase Auth',
        description: error instanceof Error ? error.message : 'Check your connection and try again later.',
        variant: 'destructive',
      });
    } finally {
      setResendingConfirmation(false);
    }
  }

  async function signUpWithGoogle() {
    if (role !== 'hostel_owner') {
      toast({
        title: 'Google signup is for hostel owners',
        description: 'Use email signup to create a caretaker account.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        toast({ title: 'Google signup failed', description: error.message, variant: 'destructive' });
      }
    } catch (error: unknown) {
      toast({
        title: 'Could not reach Google sign in',
        description: error instanceof Error ? error.message : 'Check your connection and try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f7f8fb] px-4 py-4 text-slate-900 sm:py-6">
      <div className="w-full max-w-[440px]">
        <div className="mb-3 flex items-center justify-between">
          <Link
            href={marketingUrl}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <span className="text-xs font-medium tracking-wide text-slate-400">HOSTEL MANAGER</span>
        </div>

        <Card className="border border-slate-200/80 bg-white shadow-[0_18px_55px_-28px_rgba(15,23,42,0.24)]">
          <CardHeader className="space-y-0.5 pb-2 pt-4">
            <div className="mb-0.5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-bold tracking-tight text-slate-950">Kupera</p>
                <p className="text-xs text-slate-500">Hostel &amp; PG management</p>
              </div>
            </div>
            <CardTitle className="text-xl font-semibold text-slate-950">Create your account</CardTitle>
          </CardHeader>

          <CardContent className="space-y-2.5 pb-2.5">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-slate-700">Choose your role</Label>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Select your role">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    id={`role-${r.value}`}
                    onClick={() => setRole(r.value)}
                    aria-pressed={role === r.value}
                    className={`min-h-10 rounded-lg border px-3 py-2 text-left transition ${
                      role === r.value
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-950 ring-1 ring-indigo-600'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block text-sm font-semibold">{r.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-9 w-full border-slate-300 bg-white font-medium text-slate-800 hover:bg-slate-50"
              disabled={loading || resendingConfirmation || role !== 'hostel_owner'}
              onClick={() => void signUpWithGoogle()}
            >
              <GoogleMark />
              Continue with Google
            </Button>
            {role !== 'hostel_owner' && (
              <p className="text-center text-xs text-slate-500">Google signup is available for hostel owners.</p>
            )}

            <div className="flex items-center gap-3 text-xs text-slate-400" aria-hidden="true">
              <span className="h-px flex-1 bg-slate-200" />
              or sign up with email
              <span className="h-px flex-1 bg-slate-200" />
            </div>
          </CardContent>

          <form onSubmit={handleSubmit}>
            <CardContent className="grid gap-x-3 gap-y-2 pt-0 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="signup-name" className="text-sm font-medium text-slate-700">Full name</Label>
                <Input
                  id="signup-name"
                  placeholder="Your full name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="h-9 border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                  autoComplete="name"
                  maxLength={100}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="signup-email" className="text-sm font-medium text-slate-700">Email address</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setConfirmationEmail('');
                  }}
                  className="h-9 border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                  autoComplete="email"
                  maxLength={254}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="signup-phone" className="text-sm font-medium text-slate-700">Phone number</Label>
                <IndianMobileInput
                  id="signup-phone"
                  value={phone}
                  onChange={setPhone}
                  className="h-9 border-slate-300 bg-white"
                  inputClassName="text-slate-900 placeholder:text-slate-400"
                  aria-describedby="signup-phone-help"
                  required
                />
                <p id="signup-phone-help" className="text-xs text-slate-500">
                  India (+91) is selected. Enter the 10-digit mobile number only. No OTP is sent.
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="signup-password" className="text-sm font-medium text-slate-700">Password</Label>
                <div className="relative">
                  <Input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-9 border-slate-300 bg-white pr-10 text-slate-900 placeholder:text-slate-400"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2.5 pt-0">
              <Button
                id="signup-submit"
                type="submit"
                className="h-9 w-full bg-indigo-600 font-semibold text-white hover:bg-indigo-700"
                disabled={loading || resendingConfirmation || Boolean(confirmationEmail)}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create account
              </Button>
              {confirmationEmail && (
                <div className="w-full space-y-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-950">
                  <p>
                    If the address is new, check <strong>{confirmationEmail}</strong> for a confirmation link.
                    If you already have an account, sign in instead.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 w-full border-indigo-200 bg-white"
                    disabled={loading || resendingConfirmation}
                    onClick={() => void resendConfirmation()}
                  >
                    {resendingConfirmation && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Resend confirmation email
                  </Button>
                </div>
              )}
              <p className="text-center text-sm text-slate-500">
                Already have an account?{' '}
                <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <Lock className="h-3.5 w-3.5 text-slate-400" />
          Your account is protected by Supabase authentication.
        </p>
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
