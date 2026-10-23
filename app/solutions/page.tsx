import type { Metadata } from 'next';
import { PublicContentPage } from '@/components/public-content-page';

export const metadata: Metadata = {
  title: 'Solutions',
  description: 'Kupera workflows for hostel owners, managers, and caretakers.',
};

export default function SolutionsPage() {
  return (
    <PublicContentPage
      eyebrow="Solutions"
      title="Workflows for the people running a property"
      description="Replace scattered records with consistent information your team can use throughout the resident lifecycle."
      sections={[
        { title: 'For owners', body: 'Get an overview of property inventory, residents, rent records, expenses, and team activity.' },
        { title: 'For hostel managers', body: 'Coordinate move-ins, bed assignments, rent follow-up, and routine maintenance from the manager portal.' },
        { title: 'For caretakers', body: 'Give operational team members the access needed for assigned hostel work, based on the roles configured for your deployment.' },
        { title: 'For residents', body: 'Share a resident page or invoice payment link when the related property and payment configuration is enabled.' },
      ]}
    />
  );
}
