import type { Metadata } from 'next';
import SuperAdminLoginClient from './login-client';

export const metadata: Metadata = {
  title: 'Super Admin Login — Command Center',
  description: 'Restricted access portal for HostelHub Super Administrators.',
  robots: { index: false, follow: false },
};

export default function SuperAdminLoginPage() {
  return <SuperAdminLoginClient />;
}
