import type { Metadata } from 'next';
import { AdminProvider } from '@/lib/admin-context';
import { AdminShell } from '@/components/admin-shell';

export const metadata: Metadata = {
  title: 'Super Admin Command Center | HostelHub',
  description: 'Enterprise platform administration, multi-hostel revenue oversight, and global operations.',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <AdminShell>{children}</AdminShell>
    </AdminProvider>
  );
}
