import { HeroSection } from '@/components/sections/HeroSection';
import { Badge } from '@/components/ui/Badge';
import { ArrowRight, BookOpen, CircleCheck, Compass, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

const SITE_URL = 'https://devmentorai.edwardiaz.dev';
const PAGE_PATH = '/docs';
const PAGE_URL = `${SITE_URL}${PAGE_PATH}`;

const DOC_SECTIONS = [
  {
    href: '/docs/get-started',
    title: 'Get Started',
    description:
      'Install the extension, prepare the backend, and understand the exact prerequisites before your first session.',
    highlights: ['Prerequisites checklist', 'Fast onboarding flow', 'Copilot CLI guide'],
  },
  {
    href: '/docs/quick-actions',
    title: 'Quick Actions',
    description:
      'Learn how to explain, translate, rewrite, fix grammar, summarize, and send selected text directly to chat.',
    highlights: ['Editable vs non-editable text', 'Tone rewrites', 'Add to chat flow'],
  },
  {
    href: '/docs/chat',
    title: 'Chat Workflow',
    description:
      'Create sessions, choose models by pricing tier, attach images, and use context mode for better answers.',
    highlights: ['4 session types', 'Model tiers', 'Images and context mode'],
  },
  {
    href: '/docs/settings',
    title: 'Settings',
    description:
      'Understand every setting from backend connection and themes to smart translation and quick action model defaults.',
    highlights: ['Backend URL and test', 'Smart Translation', 'Updates and model'],
  },
] as const;

const PAGE_TITLE = 'DevMentorAI Documentation';
const PAGE_DESCRIPTION =
  'Official DevMentorAI docs: installation prerequisites, Copilot CLI login, quick actions, chat workflow, and settings.';

export const metadata: Metadata = {
  title: 'Documentation',
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: PAGE_PATH,
  },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

export default function DocsPage() {
  const docsJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: PAGE_TITLE,
        description: PAGE_DESCRIPTION,
        url: PAGE_URL,
        hasPart: DOC_SECTIONS.map((section) => ({
          '@type': 'TechArticle',
          name: section.title,
          url: `${SITE_URL}${section.href}`,
          description: section.description,
        })),
      },
      {
        '@type': 'ItemList',
        itemListElement: DOC_SECTIONS.map((section, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: section.title,
          url: `${SITE_URL}${section.href}`,
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(docsJsonLd) }}
      />

      <HeroSection
        badge={<Badge icon={<BookOpen className="h-3 w-3" />}>Documentation Hub</Badge>}
        title={
          <>
            DevMentorAI docs built for <span className="text-primary">fast execution</span>
          </>
        }
        subtitle="Use these guides to install faster, avoid common setup mistakes, and get value from quick actions, chat, and settings."
      />

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 md:pb-24">
        <div className="mb-8 rounded-2xl border border-[var(--card-border)] bg-[var(--section-alt)] p-5 sm:p-6">
          <h2 className="text-lg font-bold sm:text-xl">Quick Summary</h2>
          <ul className="mt-3 space-y-2 text-sm text-[var(--muted)] sm:text-base">
            <li className="flex items-start gap-2">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Start with{' '}
              <strong className="font-semibold text-[var(--foreground)]">Get Started</strong> if
              this is your first time.
            </li>
            <li className="flex items-start gap-2">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Use the{' '}
              <strong className="font-semibold text-[var(--foreground)]">Copilot CLI guide</strong>{' '}
              before running the backend command.
            </li>
            <li className="flex items-start gap-2">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Keep this hub as reference for daily workflows and settings adjustments.
            </li>
          </ul>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {DOC_SECTIONS.map((section) => (
            <article
              key={section.href}
              className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm transition-colors hover:border-primary/40"
            >
              <h2 className="text-xl font-bold tracking-tight">{section.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
                {section.description}
              </p>

              <ul className="mt-4 space-y-2 text-sm text-[var(--muted)]">
                {section.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={section.href}
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
              >
                Open {section.title}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                <Sparkles className="h-4 w-4" />
                Most common setup blocker
              </p>
              <p className="mt-1 text-sm text-[var(--muted)] sm:text-base">
                If the backend command fails, install and login to Copilot CLI first.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <Link
                href="/docs/get-started/copilot-cli"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
              >
                Open Copilot CLI Guide
              </Link>
              <Link
                href="/installation"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--section-alt)] px-4 py-2.5 text-sm font-semibold text-[var(--muted)] transition-colors hover:text-primary"
              >
                Back to Installation
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card)] px-3 py-1.5 text-xs text-[var(--muted)]">
          <Compass className="h-3.5 w-3.5" />
          Next recommendation: follow docs in order from Get Started to Settings.
        </div>
      </section>
    </>
  );
}
