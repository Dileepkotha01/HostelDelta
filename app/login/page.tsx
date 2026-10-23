import type { Metadata } from 'next';
import LoginClient from './login-client';

export const metadata: Metadata = {
  title: 'Sign In',
  description:
    'Sign in to your HostelHub dashboard to manage rooms, tenants, payments, and more.',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Sign In — HostelHub',
    description: 'Access your hostel management dashboard.',
  },
};

export default function LoginPage() {
  return <LoginClient />;
}
