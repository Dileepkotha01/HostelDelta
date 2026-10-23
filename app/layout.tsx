import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/lib/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { ServiceWorkerRegister } from '@/components/sw-register';
import Script from 'next/script';
import { headers } from 'next/headers';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://kupera.in';

// Runs synchronously before React hydrates — prevents flash of wrong theme
const themeScript = `(function(){try{var s=localStorage.getItem('theme');if(s==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'Kupera — Smart Hostel Management & Operations Platform',
    template: '%s | Kupera',
  },
  description:
    'Kupera is an all-in-one cloud operating system for hostel and PG owners. Manage rooms, beds, tenants, rent collection, KYC, AI-powered payment reminders, maintenance, and multi-property dashboards — all in one place.',
  keywords: [
    'Kupera',
    'hostel management system',
    'hostel software',
    'PG management',
    'room booking software',
    'tenant management',
    'rent collection app',
    'hostel billing software',
    'hostel management app India',
    'bed allocation system',
    'property management software',
    'paying guest management',
    'hostel owner dashboard',
    'AI rent reminder',
    'hostel maintenance tracker',
  ],
  authors: [{ name: 'GateLink Technologies Private Limited', url: 'https://gatelink.in' }],
  creator: 'GateLink Technologies Private Limited',
  publisher: 'GateLink Technologies Private Limited',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: APP_URL,
    siteName: 'Kupera',
    title: 'Kupera — Smart Hostel Management & Operations Platform',
    description:
      'Manage rooms, beds, tenants, rent, KYC, AI payment reminders & maintenance from a single dashboard. Built for hostel owners across India.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Kupera — Smart Hostel Management Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kupera — Smart Hostel Management Platform',
    description:
      'All-in-one hostel management: rooms, beds, tenants, rent, KYC & AI reminders. Built for hostel owners.',
    images: ['/og-image.png'],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Kupera',
  },
  formatDetection: {
    telephone: true,
    address: true,
    email: true,
  },
  category: 'business',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = headers().get('x-nonce') || undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Sync theme script: runs before paint to prevent dark/light flash */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Script nonce={nonce} src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
        <link rel="icon" href="/icon-192.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon-192.svg" />
        <script
          nonce={nonce}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'Kupera',
              url: APP_URL,
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web',
              description:
                'All-in-one hostel and PG operations platform. Manage rooms, beds, tenants, automated rent billing, KYC, and maintenance.',
              featureList: [
                'Room & Bed Management',
                'Tenant Onboarding & KYC',
                'Automated Rent Billing',
                'AI Voice Payment Reminders',
                'Multi-Hostel Switching',
                'Maintenance Tracking',
                'Payment Collection',
              ],
            }),
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            {children}
            <Toaster />
            <ServiceWorkerRegister />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
