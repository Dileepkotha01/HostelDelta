import type { Metadata } from 'next';
import { PublicContentPage } from '@/components/public-content-page';

export const metadata: Metadata = {
  title: 'How it works',
  description: 'See the Kupera hostel operations workflow from property setup to rent tracking.',
};

export default function ExperiencePage() {
  return (
    <PublicContentPage
      eyebrow="How it works"
      title="A practical workflow, from setup to daily operations"
      description="Start by building a property record, then use the same workspace to maintain resident and operational information."
      sections={[
        { title: '1. Create your property', body: 'Register an owner account and verify it. Then use Add Hostel to enter your property details and choose its floors, rooms, and beds.' },
        { title: '2. Add residents', body: 'Create resident records, assign an available bed, and keep relevant contact and agreement details current.' },
        { title: '3. Track rent', body: 'Create billing records, monitor outstanding balances, and record payments. Online payment availability depends on the payment gateway setup.' },
        { title: '4. Run daily operations', body: 'Log expenses, manage maintenance tasks, and use role-appropriate access for the people working at the property.' },
      ]}
    />
  );
}
