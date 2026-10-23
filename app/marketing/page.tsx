'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  Shield,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Menu,
  X,
  Bell,
  Lock,
  QrCode,
  ChevronRight,
  Globe2,
} from 'lucide-react';
import { getPortalUrl } from '@/lib/portal-urls';

const NAV_LINKS = [
  { href: '/product', label: 'Product' },
  { href: '/solutions', label: 'Solutions' },
  { href: '/experience', label: 'How it works' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/contact', label: 'Contact' },
];

const PLATFORM_FEATURES = [
  {
    icon: Building2,
    badge: 'Inventory & Rooms',
    title: 'Visual Bed Allocation & Floor Maps',
    desc: 'Organize floors, rooms, bed capacity, and vacancy status from a single inventory view.',
    highlight: 'Room and bed inventory',
    color: 'text-blue-600 bg-blue-50 border-blue-200/60',
  },
  {
    icon: Users,
    badge: 'Resident records',
    title: 'Resident records and onboarding',
    desc: 'Maintain resident contact, emergency contact, identity-document, agreement, and allocation details.',
    highlight: 'Centralized resident records',
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200/60',
  },
  {
    icon: QrCode,
    badge: 'Rent tracking',
    title: 'Invoices and payment records',
    desc: 'Track rent invoices, record payments, and provide payment links where a payment provider is configured.',
    highlight: 'Invoice and payment history',
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200/60',
  },
  {
    icon: Bell,
    badge: 'Reminders',
    title: 'Payment follow-up tools',
    desc: 'Review due and overdue accounts and coordinate follow-ups with your team. Automated voice and messaging depend on provider setup.',
    highlight: 'Operational follow-up visibility',
    color: 'text-amber-600 bg-amber-50 border-amber-200/60',
  },
  {
    icon: BarChart3,
    badge: 'Financial Ledger',
    title: 'Daily Expense Ledger & Net Profit Intelligence',
    desc: 'Log food provisions, maintenance, cleaning supplies, and staff payroll right alongside your rent collections to see real-time net profit margins.',
    highlight: 'Expense history by property',
    color: 'text-rose-600 bg-rose-50 border-rose-200/60',
  },
  {
    icon: Shield,
    badge: 'Cloud Security',
    title: 'Role-Based Control for Owners & Caretakers',
    desc: 'Strict multi-tier permissions protect your tenant data and financials. Caretakers log expenses and complaints without seeing your master account earnings.',
    highlight: 'Role-aware portal access',
    color: 'text-violet-600 bg-violet-50 border-violet-200/60',
  },
];

const METRICS = [
  { value: 'Inventory', label: 'Floors and rooms', detail: 'Track bed capacity and vacancy' },
  { value: 'Residents', label: 'Resident records', detail: 'Keep allocations and contacts together' },
  { value: 'Rent', label: 'Invoices and payments', detail: 'Review rent status by resident' },
  { value: 'Operations', label: 'Daily workflows', detail: 'Record expenses and maintenance' },
];

export default function MarketingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [loginUrl, setLoginUrl] = useState('/login');
  const [signupUrl, setSignupUrl] = useState('/signup');
  const [adminUrl, setAdminUrl] = useState('/admin/login');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLocal =
        window.location.hostname.includes('localhost') ||
        window.location.hostname.includes('127.0.0.1');
      if (isLocal) {
        setLoginUrl('/login');
        setSignupUrl('/signup');
        setAdminUrl('/admin/login');
      } else {
        setLoginUrl(getPortalUrl('app', '/login'));
        setSignupUrl(getPortalUrl('app', '/signup'));
        setAdminUrl(getPortalUrl('admin', '/'));
      }
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAFC] text-slate-900 selection:bg-blue-600 selection:text-white font-sans antialiased overflow-x-hidden">
      {/* ── Top Announcement Banner ── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white text-xs sm:text-sm py-2 px-4 text-center font-medium">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/15 text-white uppercase tracking-wide">
            Kupera
          </span>
          <span>Hostel and PG operations, organized in one workspace.</span>
          <a
            href={signupUrl}
            className="hidden sm:inline-flex items-center font-semibold text-indigo-300 hover:text-white ml-1 underline underline-offset-2"
          >
            Explore the product →
          </a>
        </div>
      </div>

      {/* ── Precision Navigation Bar (Apple / Google Style) ── */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/85 backdrop-blur-xl border-b border-slate-200/80 shadow-sm'
            : 'bg-white/70 backdrop-blur-md border-b border-slate-100'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-slate-950 flex items-center gap-1.5">
                Kupera
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" />
              </span>
              <span className="text-[10px] text-slate-500 font-medium tracking-wide uppercase -mt-0.5">
                Smart Hostel OS
              </span>
            </div>
          </Link>

          {/* Desktop Nav Items */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-slate-600 hover:text-slate-950 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Header Action CTAs */}
          <div className="hidden sm:flex items-center gap-3">
            <a
              href={loginUrl}
              className="text-sm font-semibold text-slate-700 hover:text-slate-950 px-4 py-2 rounded-lg hover:bg-slate-100/80 transition-colors"
            >
              Sign In
            </a>
            <a
              href={signupUrl}
              className="inline-flex items-center gap-2 text-sm font-semibold text-white px-4.5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 shadow-sm hover:shadow transition-all duration-200 hover:-translate-y-0.5"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-950 hover:bg-slate-100"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div id="mobile-navigation" className="md:hidden bg-white border-b border-slate-200 px-6 py-5 space-y-4 shadow-xl">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block text-base font-medium text-slate-700 hover:text-blue-600 py-1"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
              <a
                href={loginUrl}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Hostel Manager Login
              </a>
              <a
                href={signupUrl}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 rounded-xl bg-slate-950 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                Create an account
              </a>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero Section (Clean, Apple-inspired whitespace & crisp typography) ── */}
      <section className="relative pt-16 sm:pt-24 pb-20 sm:pb-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Subtle geometric light backdrops */}
        <div className="absolute inset-0 pointer-events-none -z-10">
          <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-tr from-blue-100/70 via-indigo-50/50 to-purple-100/60 rounded-full blur-[110px]" />
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        </div>

        <div className="max-w-5xl mx-auto text-center space-y-7">
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-slate-200/90 bg-white/90 shadow-sm text-xs font-semibold text-slate-700 backdrop-blur-md">
            <span className="flex h-2 w-2 rounded-full bg-blue-600" />
            <span>Designed for hostel and PG teams</span>
            <span className="text-slate-300">|</span>
            <span className="text-blue-600 font-medium">Property operations</span>
          </div>

          {/* Primary Hero Heading */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-950 leading-[1.08]">
            A clearer way to manage{' '}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
              modern hostels & PGs.
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-lg sm:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed font-normal">
            Kupera brings room inventory, resident records, rent tracking, expenses, and day-to-day hostel operations into one workspace.
          </p>

          {/* Action Call To Actions */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <a
              href={signupUrl}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-slate-950 text-white font-semibold text-base shadow-sm hover:bg-slate-800 transition-all duration-200 hover:-translate-y-0.5 group"
            >
              <span>Create an account</span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </a>
            <a
              href="#experience"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-base shadow-sm hover:bg-slate-50 transition-colors"
            >
              <span>See How It Works</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </a>
          </div>

          {/* Trust Guarantees */}
          <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-xs sm:text-sm text-slate-500 pt-4 font-medium">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Room and bed inventory</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Resident and rent records</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Owner and caretaker workflows</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Role-aware access</span>
            </div>
          </div>

          {/* ── High-Resolution Product Interface Preview (Clean White Studio Render) ── */}
          <div className="pt-10 sm:pt-14 relative max-w-5xl mx-auto">
            <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-200/80 p-2 sm:p-4 text-left">
              {/* Browser Header Bar */}
              <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-slate-100 bg-slate-50/70 rounded-xl mb-3 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-rose-400" />
                    <span className="w-3 h-3 rounded-full bg-amber-400" />
                    <span className="w-3 h-3 rounded-full bg-emerald-400" />
                  </div>
                  <span className="ml-3 font-mono text-[11px] text-slate-500 hidden sm:inline bg-white px-2.5 py-0.5 rounded-md border border-slate-200">
                    {`${(process.env.NEXT_PUBLIC_APP_SUBDOMAIN || 'https://app.kupera.in').replace(/\/$/, '')}/dashboard`}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-700 font-medium text-[11px] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <Lock className="w-3 h-3" />
                  <span>Product preview · sample data</span>
                </div>
              </div>

              {/* Example interface values; not live customer data */}
              <div className="p-4 sm:p-6 bg-slate-50/60 rounded-xl border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Metric 1 */}
                <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>EXAMPLE OCCUPANCY</span>
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                      94% Full
                    </span>
                  </div>
                  <p className="text-3xl font-extrabold text-slate-950">142 / 150 Beds</p>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-full w-[94%]" />
                  </div>
                  <p className="text-xs text-slate-500">8 vacant beds across 3 rooms</p>
                </div>

                {/* Metric 2 */}
                <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>EXAMPLE RENT COLLECTIONS</span>
                    <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-bold">
                      Payment tracking
                    </span>
                  </div>
                  <p className="text-3xl font-extrabold text-slate-950">₹8,45,000</p>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full w-[88%]" />
                  </div>
                  <p className="text-xs text-slate-500">Example collection status</p>
                </div>

                {/* Metric 3 */}
                <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>FOLLOW-UP WORKFLOW</span>
                    <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-bold">
                      Example
                    </span>
                  </div>
                  <p className="text-lg font-bold text-slate-900">Review due accounts</p>
                  <p className="text-xs text-emerald-700 font-medium">Coordinate resident follow-up</p>
                  <p className="text-xs text-slate-400">Example interface content</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Key Impact Numbers Section ── */}
      <section className="border-y border-slate-200/80 bg-white py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {METRICS.map((metric) => (
            <div key={metric.label} className="space-y-1">
              <p className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
                {metric.value}
              </p>
              <p className="text-sm font-semibold text-slate-800">{metric.label}</p>
              <p className="text-xs text-slate-500 hidden sm:block">{metric.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Precision Product Architecture (Google/Apple Design) ── */}
      <section id="solutions" className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200/60">
              Operations Architecture
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-950 tracking-tight">
              Designed for clarity. Built for scale.
            </h2>
            <p className="text-slate-600 text-base sm:text-lg">
              Every detail is engineered to give property owners total control with zero operational friction.
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {PLATFORM_FEATURES.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="bg-white p-8 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 flex flex-col justify-between"
                >
                  <div>
                    <div
                      className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-6 ${feat.color}`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide block mb-1.5">
                      {feat.badge}
                    </span>
                    <h3 className="text-xl font-bold text-slate-950 mb-3 leading-snug">
                      {feat.title}
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed mb-6">{feat.desc}</p>
                  </div>
                  <div className="pt-4 border-t border-slate-100 flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{feat.highlight}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Interactive Workflow Experience (How It Works) ── */}
      <section id="experience" className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-slate-50 border-y border-slate-200/80">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200/60">
              The Resident Journey
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              Four steps from arrival to automated checkout.
            </h2>
            <p className="text-slate-600 text-sm sm:text-base">
              Keep room, resident, and operational information organized in one workspace.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: '01',
                title: 'Build Visual Rooms',
                desc: 'Add your floors, room types (Single/Double/Triple), and pricing in under 4 minutes with our guided wizard.',
                tag: '4 Min Setup',
              },
              {
                step: '02',
                title: 'Onboard Residents',
                desc: 'Create resident records, capture relevant details, and assign an available bed.',
                tag: 'Resident records',
              },
              {
                step: '03',
                title: 'Rent Tracking',
                desc: 'Review invoices, outstanding balances, and payment records. Online collection depends on your payment provider setup.',
                tag: 'Payment configuration',
              },
              {
                step: '04',
                title: 'Profit & Net Margins',
                desc: 'Track operational costs (cook, electricity, Wi-Fi, laundry) to know your actual monthly bottom-line cashflow.',
                tag: 'Expense tracking',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-white p-7 rounded-2xl border border-slate-200/90 shadow-sm space-y-4 hover:border-blue-400 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-extrabold text-slate-300 font-mono">
                    {item.step}
                  </span>
                  <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                    {item.tag}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-950">{item.title}</h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Pricing</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
            Talk with us about plans and availability.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">
            Contact GateLink for current product availability, pricing, and payment-provider requirements. We do not display unverified plan or transaction-fee promises.
          </p>
          <Link href="/contact" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-6 py-3 font-semibold text-white hover:bg-slate-800">
            Contact the team <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── Crisp Final CTA Banner ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-t border-slate-200/80">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-950 tracking-tight">
            Ready to streamline your hostel?
          </h2>
          <p className="text-slate-600 text-base sm:text-lg max-w-2xl mx-auto">
            Explore the manager portal or contact GateLink for product and onboarding information.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <a
              href={signupUrl}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-slate-950 text-white font-semibold text-base shadow-sm hover:bg-slate-800 transition-colors"
            >
              Create an account
            </a>
            <a
              href={loginUrl}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl border border-slate-200 text-slate-800 font-semibold text-base hover:bg-slate-50 transition-colors"
            >
              Sign In to Manager Portal
            </a>
          </div>
        </div>
      </section>

      {/* ── Comprehensive Clean Footer ── */}
      <footer className="border-t border-slate-200 bg-slate-50 pt-16 pb-12 px-4 sm:px-6 lg:px-8 text-slate-600">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-14">
            {/* Col 1 & 2: Brand details */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-950 flex items-center justify-center text-white">
                  <Building2 className="w-4 h-4" />
                </div>
                <span className="text-xl font-bold text-slate-950 tracking-tight">Kupera</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed max-w-sm">
                Kupera is a hostel and PG operations product from GateLink Technologies Private Limited.
              </p>
            </div>

            {/* Col 3: Navigation */}
            <div className="space-y-3">
              <p className="text-xs uppercase font-bold text-slate-950 tracking-wider">Product</p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li><Link href="/product" className="hover:text-slate-950 transition-colors">Hostel manager workspace</Link></li>
                <li><Link href="/solutions" className="hover:text-slate-950 transition-colors">Inventory and resident records</Link></li>
                <li><Link href="/experience" className="hover:text-slate-950 transition-colors">How it works</Link></li>
                <li><Link href="/pricing" className="hover:text-slate-950 transition-colors">Plans and availability</Link></li>
              </ul>
            </div>

            {/* Col 4: Portals */}
            <div className="space-y-3">
              <p className="text-xs uppercase font-bold text-slate-950 tracking-wider">Access Portals</p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li>
                  <a href={loginUrl} className="hover:text-blue-600 font-medium text-slate-900 transition-colors">
                    Hostel Manager Portal →
                  </a>
                </li>
                <li>
                  <a href={adminUrl} className="hover:text-blue-600 font-medium text-slate-900 transition-colors">
                    Super Admin Console →
                  </a>
                </li>
                <li>
                  <a href={signupUrl} className="hover:text-slate-950 transition-colors">
                    Create New Account
                  </a>
                </li>
                <li>
                  <a href="/tenant" className="hover:text-slate-950 transition-colors">
                    Resident Dues & Invoices
                  </a>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-slate-950 transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-slate-950 transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li><Link href="/about" className="hover:text-slate-950 transition-colors">About GateLink</Link></li>
              </ul>
            </div>

            {/* Col 5: Contact Info */}
            <div className="space-y-3">
              <p className="text-xs uppercase font-bold text-slate-950 tracking-wider">Company</p>
              <p className="text-sm leading-relaxed">GateLink Technologies Private Limited</p>
              <Link
                href="https://gatelink.in"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900"
              >
                Visit gatelink.in <Globe2 className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} GateLink Technologies Private Limited. Kupera is its product.</p>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                <Globe2 className="w-3.5 h-3.5 text-blue-600" /> Made for Indian Hostel Owners 🇮🇳
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
