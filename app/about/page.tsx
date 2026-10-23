import type { Metadata } from 'next';
import { PublicContentPage } from '@/components/public-content-page';

export const metadata: Metadata = {
  title: 'About GateLink',
  description: 'Kupera is a hostel management product from GateLink Technologies Private Limited.',
};

export default function AboutPage() {
  return (
    <PublicContentPage
      eyebrow="Company"
      title="Kupera by GateLink Technologies"
      description="Kupera is a product of GateLink Technologies Private Limited. The Kupera platform provides digital tools for organizing hostel and PG property operations."
      ctaLabel="Visit gatelink.in"
      ctaHref="https://gatelink.in"
      sections={[
        { title: 'The product', body: 'Kupera brings property inventory, resident records, rent tracking, expenses, and operational workflows into a web-based management portal.' },
        { title: 'The company', body: 'For current company information and official contact details, visit GateLink Technologies at gatelink.in.' },
      ]}
    />
  );
}
