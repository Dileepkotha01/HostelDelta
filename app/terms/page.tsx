import type { Metadata } from 'next';
import { PublicContentPage } from '@/components/public-content-page';

export const metadata: Metadata = {
  title: 'Terms of service',
  description: 'Terms for using the Kupera hostel management platform.',
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <PublicContentPage
      eyebrow="Terms"
      title="Terms of service"
      description="Last updated 13 October 2026. These terms apply to access to Kupera, a product of GateLink Technologies Private Limited."
      ctaLabel="Visit gatelink.in"
      ctaHref="https://gatelink.in"
      sections={[
        {
          title: 'Using the service',
          body: 'You may use Kupera only for lawful hostel and property-management purposes and in accordance with these terms. You are responsible for accurate account and property information and for keeping your credentials confidential.',
        },
        {
          title: 'Accounts and access',
          body: 'Account owners are responsible for managing team access and ensuring each person uses an account appropriate to their role. Do not attempt to bypass access controls or access another organization’s information.',
        },
        {
          title: 'Customer information',
          body: 'You retain responsibility for the data you enter, including resident and identity-document information. You must have the rights and permissions required to provide that information and use it through the service.',
        },
        {
          title: 'Payments and third parties',
          body: 'Payment availability, payment methods, transaction charges, settlement, refunds, and disputes are subject to the configured payment provider’s terms. A payment status in Kupera does not replace the provider’s official transaction record.',
        },
        {
          title: 'Availability and changes',
          body: 'Features may depend on configuration and third-party services. We may change or suspend functionality for maintenance, security, legal compliance, or service-provider issues. No uptime or service-level commitment is made on this page.',
        },
        {
          title: 'Contact and governing terms',
          body: 'For questions about these terms, use the official contact information at gatelink.in. Any governing-law and dispute-resolution terms should be confirmed in a final version approved by GateLink Technologies Private Limited.',
        },
      ]}
    />
  );
}
