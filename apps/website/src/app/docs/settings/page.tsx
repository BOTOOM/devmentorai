import { HeroSection } from '@/components/sections/HeroSection';
import { Badge } from '@/components/ui/Badge';
import { ArrowRight, Cog, Globe2, Languages, Link2, Settings, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

const SITE_URL = 'https://devmentorai.edwardiaz.dev';
const PAGE_PATH = '/docs/settings';
const PAGE_URL = `${SITE_URL}${PAGE_PATH}`;

const PAGE_TITLE = 'DevMentorAI Settings Guide';
const PAGE_DESCRIPTION =
  'Understand every DevMentorAI setting: backend connection, appearance, smart translation, screenshot behavior, quick action model, and updates.';

export const metadata: Metadata = {
  title: 'Docs: Settings',
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: PAGE_PATH,
  },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

export default function DocsSettingsPage() {
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        headline: PAGE_TITLE,
        description: PAGE_DESCRIPTION,
        url: PAGE_URL,
        about: ['Backend Connection', 'Appearance', 'Smart Translation', 'Quick Actions'],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Docs',
            item: `${SITE_URL}/docs`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: 'Settings',
            item: PAGE_URL,
          },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <HeroSection
        badge={<Badge icon={<Settings className="h-3 w-3" />}>Settings Documentation</Badge>}
        title={
          <>
            Configure DevMentorAI with <span className="text-primary">full control</span>
          </>
        }
        subtitle="This settings map mirrors the extension Options page so you can understand what each setting changes before applying it."
      />

      <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6 md:pb-24">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--section-alt)] p-5 sm:p-6">
            <h2 className="text-lg font-bold sm:text-xl">Quick Summary</h2>
            <ul className="mt-3 space-y-2 text-sm text-[var(--muted)] sm:text-base">
              <li>Use Backend Connection to change URL and validate connectivity.</li>
              <li>
                Appearance and language settings control extension visual behavior and locale
                intent.
              </li>
              <li>
                Smart Translation, screenshots, and quick action model settings directly affect
                writing workflows.
              </li>
            </ul>
          </article>

          <aside className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 sm:p-6">
            <p className="text-sm font-semibold">On this page</p>
            <nav aria-label="Settings docs table of contents" className="mt-3 space-y-2 text-sm">
              <a
                href="#backend"
                className="block rounded-md px-2 py-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--section-alt)] hover:text-primary"
              >
                Backend connection
              </a>
              <a
                href="#appearance"
                className="block rounded-md px-2 py-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--section-alt)] hover:text-primary"
              >
                Appearance
              </a>
              <a
                href="#translation"
                className="block rounded-md px-2 py-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--section-alt)] hover:text-primary"
              >
                Smart Translation
              </a>
              <a
                href="#screenshots"
                className="block rounded-md px-2 py-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--section-alt)] hover:text-primary"
              >
                Images and screenshots
              </a>
              <a
                href="#quick-actions"
                className="block rounded-md px-2 py-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--section-alt)] hover:text-primary"
              >
                Quick action model and updates
              </a>
            </nav>
          </aside>
        </div>

        <article
          id="backend"
          className="mt-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 sm:p-6"
        >
          <h2 className="inline-flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
            <Link2 className="h-5 w-5 text-primary" />
            Backend Connection
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-[var(--muted)] sm:text-base">
            <li>Set the backend URL (default typically points to localhost).</li>
            <li>
              Use <strong className="text-[var(--foreground)]">Test Connection</strong> to verify
              health endpoint response.
            </li>
            <li>Useful when your backend runs on a custom port or private server URL.</li>
          </ul>
        </article>

        <article
          id="appearance"
          className="mt-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 sm:p-6"
        >
          <h2 className="inline-flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
            <Globe2 className="h-5 w-5 text-primary" />
            Appearance
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] p-4">
              <h3 className="text-lg font-semibold">Theme</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
                Choose light, dark, or system mode. System mode follows your browser/OS preference.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] p-4">
              <h3 className="text-lg font-semibold">Language caveat</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
                Interface language selection exists, but browser extension locale behavior can still
                depend on browser language defaults.
              </p>
            </div>
          </div>
        </article>

        <article
          id="translation"
          className="mt-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 sm:p-6"
        >
          <h2 className="inline-flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
            <Languages className="h-5 w-5 text-primary" />
            Smart Translation
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] p-4">
              <h3 className="text-lg font-semibold">Native language (reading)</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
                Used when translating non-editable selected text for comprehension.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] p-4">
              <h3 className="text-lg font-semibold">Target language (writing)</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
                Used for editable-field translation output, optimized for replacement workflows.
              </p>
            </div>
          </div>
        </article>

        <article
          id="screenshots"
          className="mt-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 sm:p-6"
        >
          <h2 className="inline-flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Images and screenshot permissions
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-[var(--muted)] sm:text-base">
            <li>Enable or disable image attachments in chat.</li>
            <li>Choose screenshot behavior for context mode: disabled, ask, or auto.</li>
            <li>
              Asking mode prompts before capture; auto mode captures immediately when context mode
              is enabled.
            </li>
          </ul>
        </article>

        <article
          id="quick-actions"
          className="mt-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 sm:p-6"
        >
          <h2 className="inline-flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
            <Cog className="h-5 w-5 text-primary" />
            Quick action model and updates
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-[var(--muted)] sm:text-base">
            <li>
              Select default quick action model for actions like grammar fix, rewrite, and
              translate.
            </li>
            <li>Choose text replacement behavior: ask, auto, or copy only.</li>
            <li>Use update checker to verify extension/backend update availability.</li>
          </ul>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/docs/chat"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
            >
              Back to Chat Workflow
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/support"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--section-alt)] px-4 py-2.5 text-sm font-semibold text-[var(--muted)] transition-colors hover:text-primary"
            >
              Need help with settings?
            </Link>
          </div>
        </article>
      </section>
    </>
  );
}
