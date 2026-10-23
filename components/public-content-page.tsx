import Link from 'next/link';

type ContentSection = {
  title: string;
  body: string;
  points?: string[];
};

type PublicContentPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  sections: ContentSection[];
  ctaLabel?: string;
  ctaHref?: string;
};

const links = [
  { href: '/product', label: 'Product' },
  { href: '/solutions', label: 'Solutions' },
  { href: '/experience', label: 'How it works' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/contact', label: 'Contact' },
];

export function PublicContentPage({
  eyebrow,
  title,
  description,
  sections,
  ctaLabel = 'Create an account',
  ctaHref = `${process.env.NEXT_PUBLIC_APP_SUBDOMAIN || 'https://app.kupera.in'}/signup`,
}: PublicContentPageProps) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="text-xl font-bold tracking-tight">Kupera</Link>
          <nav aria-label="Main navigation" className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
            {links.map((link) => <Link key={link.href} href={link.href} className="hover:text-slate-950">{link.label}</Link>)}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-14 sm:py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-700">{eyebrow}</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-5 text-lg leading-relaxed text-slate-600">{description}</p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {sections.map((section) => (
            <section key={section.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">{section.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{section.body}</p>
              {section.points && (
                <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-600">
                  {section.points.map((point) => <li key={point}>{point}</li>)}
                </ul>
              )}
            </section>
          ))}
        </div>

        {ctaLabel && (
          <div className="mt-10 rounded-2xl bg-slate-900 p-7 text-white sm:flex sm:items-center sm:justify-between">
            <p className="max-w-2xl text-sm leading-relaxed text-slate-200">
              Kupera is a product of GateLink Technologies Private Limited.
            </p>
            <Link href={ctaHref} className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-100 sm:mt-0">
              {ctaLabel}
            </Link>
          </div>
        )}
      </div>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-6 text-sm text-slate-600">
          <p>© {new Date().getFullYear()} GateLink Technologies Private Limited · Kupera</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/about" className="hover:text-slate-950">About</Link>
            <Link href="/privacy" className="hover:text-slate-950">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-950">Terms</Link>
            <Link href="https://gatelink.in" target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-700 hover:text-indigo-900">gatelink.in</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
