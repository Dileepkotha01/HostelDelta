import type { Metadata } from 'next';
import { PublicContentPage } from '@/components/public-content-page';
import {
  HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_INR,
  HOSTEL_SUBSCRIPTION_TRIAL_DAYS,
} from '@/lib/hostel-subscription';

export const metadata: Metadata = {
  title: 'Hostel subscription pricing',
  description: `Choose automatic monthly renewal after a ${HOSTEL_SUBSCRIPTION_TRIAL_DAYS}-day trial or a one-time ₹${HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_INR.toLocaleString('en-IN')} payment for 30 days.`,
};

export default function PricingPage() {
  return (
    <PublicContentPage
      eyebrow="Flexible hostel billing"
      title={`₹${HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_INR.toLocaleString('en-IN')} per hostel`}
      description="Choose a one-time payment with no autopay mandate, or authorize automatic monthly renewal."
      ctaLabel="Visit GateLink"
      ctaHref="https://gatelink.in"
      sections={[
        { title: 'Per-hostel billing', body: `The ₹${HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_INR.toLocaleString('en-IN')} monthly subscription applies separately to each hostel workspace. Add another hostel to start a separate ${HOSTEL_SUBSCRIPTION_TRIAL_DAYS}-day trial and subscription for that property.` },
        { title: 'One-time payment', body: `Pay ₹${HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_INR.toLocaleString('en-IN')} using the standard payment methods enabled in Razorpay. The payment activates one hostel for 30 days and does not create an autopay mandate. Renew manually when the period expires.` },
        { title: 'Optional automatic renewal', body: `Choose a recurring monthly mandate to start with a ${HOSTEL_SUBSCRIPTION_TRIAL_DAYS}-day free trial, then continue at ₹${HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_INR.toLocaleString('en-IN')} per month. Razorpay only offers autopay methods supported for the customer’s bank and account; any mandate amount and terms are shown before approval.` },
        { title: 'Payment provider terms', body: 'Recurring payment availability, mandate authorization, gateway fees, and settlement terms depend on Razorpay and the owner’s payment provider.' },
      ]}
    />
  );
}
