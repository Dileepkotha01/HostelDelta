import type { Metadata } from 'next';
import { PublicContentPage } from '@/components/public-content-page';

export const metadata: Metadata = {
  title: 'Product',
  description: 'Explore the Kupera hostel and PG management workspace.',
};

export default function ProductPage() {
  return (
    <PublicContentPage
      eyebrow="Kupera product"
      title="One workspace for hostel operations"
      description="Kupera helps hostel and PG teams organize their property, resident, rent, and day-to-day operational records."
      sections={[
        { title: 'Property inventory', body: 'Organize multiple properties, floors, rooms, and bed capacity. See vacancy and occupancy status in context.' },
        { title: 'Resident management', body: 'Keep resident profiles, emergency contacts, agreements, assigned beds, and move-in details together.' },
        { title: 'Rent and payments', body: 'Review billing periods, outstanding balances, recorded payments, and resident payment links.' },
        { title: 'Operations and reporting', body: 'Track maintenance work and expenses, and review operational data from a property workspace.' },
      ]}
    />
  );
}
