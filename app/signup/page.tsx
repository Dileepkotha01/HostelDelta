import type { Metadata } from 'next';
import SignupClient from './signup-client';

export const metadata: Metadata = {
  title: 'Create Account',
  description:
    'Create your free HostelHub account. Manage your hostel, rooms, tenants, and rent collection from one powerful dashboard.',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Create Account — HostelHub',
    description:
      'Sign up free and start managing your hostel with HostelHub. Rooms, beds, tenants, payments, and more.',
  },
};

export default function SignupPage() {
  return <SignupClient />;
}
