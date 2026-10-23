import type { Metadata } from 'next';
import { PublicContentPage } from '@/components/public-content-page';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contact GateLink Technologies Private Limited about Kupera.',
};

export default function ContactPage() {
  return (
    <PublicContentPage
      eyebrow="Contact"
      title="Talk to the team behind Kupera"
      description="Kupera is a product of GateLink Technologies Private Limited. Visit GateLink’s website for current company and contact information."
      ctaLabel="Visit gatelink.in"
      ctaHref="https://gatelink.in"
      sections={[
        { title: 'Product information', body: 'For Kupera availability, onboarding, or pricing questions, use the contact information published on GateLink’s website.' },
        { title: 'Existing users', body: 'For account or property access questions, sign in through the relevant portal and contact your organization administrator.' },
      ]}
    />
  );
}
