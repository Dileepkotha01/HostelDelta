import type { Metadata } from 'next';
import { PublicContentPage } from '@/components/public-content-page';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'Privacy information for the Kupera hostel management platform.',
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <PublicContentPage
      eyebrow="Privacy"
      title="Privacy policy"
      description="Last updated 13 October 2026. This policy describes information processed through Kupera, a product of GateLink Technologies Private Limited."
      ctaLabel="Visit gatelink.in"
      ctaHref="https://gatelink.in"
      sections={[
        {
          title: 'Information processed',
          body: 'Depending on how the service is used, information may include account details, contact information, property and room records, resident details, identity documents uploaded by a property operator, billing and payment records, and technical logs needed to run and secure the service.',
        },
        {
          title: 'How information is used',
          body: 'Information is used to authenticate users, provide property and resident workflows, operate configured payment and communications features, maintain platform security, troubleshoot errors, and meet applicable legal obligations.',
        },
        {
          title: 'Customer-provided resident information',
          body: 'Property operators are responsible for having an appropriate legal basis and providing required notices before entering resident or identity-document information. Do not upload information that is not necessary for the intended service.',
        },
        {
          title: 'Service providers and transfers',
          body: 'Kupera relies on third-party infrastructure and providers. Depending on which features are enabled, this may include Supabase for authentication, database, and storage services; Google for OAuth; Razorpay for payment processing; and configured email, SMS, or voice providers.',
        },
        {
          title: 'Retention, security, and requests',
          body: 'Information is retained as needed to provide the service, meet legal requirements, and resolve disputes. Access controls and database policies are used to protect account data, but no internet service can guarantee absolute security. For privacy requests, account holders should contact GateLink through the official company website.',
        },
        {
          title: 'Policy updates',
          body: 'This notice may change as product features and service providers change. The updated version and date will be published on this page.',
        },
      ]}
    />
  );
}
