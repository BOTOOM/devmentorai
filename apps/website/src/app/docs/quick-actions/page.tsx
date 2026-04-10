import { HeroSection } from '@/components/sections/HeroSection';
import { Badge } from '@/components/ui/Badge';
import { ArrowRight, Sparkles, Wand2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

const SITE_URL = 'https://devmentorai.edwardiaz.dev';
const PAGE_PATH = '/docs/quick-actions';
const PAGE_URL = `${SITE_URL}${PAGE_PATH}`;

const PAGE_TITLE = 'DevMentorAI Quick Actions Guide';
const PAGE_DESCRIPTION =
  'Learn every DevMentorAI quick action: explain, translate, rewrite, fix grammar, summarize, tone rewrites, and add selected text to chat.';

const QUICK_ACTIONS = [
  {
    id: 'explain',
    label: 'Explain',
    useCase: 'Understand complex text or code snippets faster.',
  },
  {
    id: 'translate',
    label: 'Translate',
    useCase: 'Translate selected content based on your smart translation settings.',
  },
  {
    id: 'rewrite',
    label: 'Rewrite',
    useCase: 'Improve clarity and style while preserving your intent.',
  },
  {
    id: 'fix_grammar',
    label: 'Fix Grammar',
    useCase: 'Correct grammar and spelling in a single action.',
  },
  {
    id: 'summarize',
    label: 'Summarize',
    useCase: 'Reduce long content into a concise summary.',
  },
  {
    id: 'rewrite_tone',
    label: 'Change Tone',
    useCase:
      'Rewrite text with a specific tone (formal, casual, technical, friendly, professional, concise).',
  },
] as const;

export const metadata: Metadata = {
  title: 'Docs: Quick Actions',
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

export default function DocsQuickActionsPage() {
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        headline: PAGE_TITLE,
        description: PAGE_DESCRIPTION,
        url: PAGE_URL,
        about: ['Quick actions', 'Text selection toolbar', 'Translation and rewriting'],
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
            name: 'Quick Actions',
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
        badge={<Badge icon={<Wand2 className="h-3 w-3" />}>Quick Actions</Badge>}
        title={
          <>
            Transform selected text in <span className="text-primary">one click</span>
          </>
        }
        subtitle="Quick actions help you explain, translate, rewrite, and summarize text directly in your browser without losing context."
      />

      <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6 md:pb-24">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--section-alt)] p-5 sm:p-6">
            <h2 className="text-lg font-bold sm:text-xl">Quick Summary</h2>
            <ul className="mt-3 space-y-2 text-sm text-[var(--muted)] sm:text-base">
              <li>Use quick actions after selecting text on any page.</li>
              <li>
                For editable fields, output can be replaced automatically or manually depending on
                your settings.
              </li>
              <li>
                Use <strong className="text-[var(--foreground)]">Add to chat</strong> when you need
                multi-step assistance.
              </li>
            </ul>
          </article>

          <aside className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 sm:p-6">
            <p className="text-sm font-semibold">On this page</p>
            <nav aria-label="Quick actions table of contents" className="mt-3 space-y-2 text-sm">
              <a
                href="#actions"
                className="block rounded-md px-2 py-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--section-alt)] hover:text-primary"
              >
                Available actions
              </a>
              <a
                href="#editable"
                className="block rounded-md px-2 py-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--section-alt)] hover:text-primary"
              >
                Editable vs non-editable
              </a>
              <a
                href="#add-to-chat"
                className="block rounded-md px-2 py-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--section-alt)] hover:text-primary"
              >
                Add to chat flow
              </a>
            </nav>
          </aside>
        </div>

        <article
          id="actions"
          className="mt-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 sm:p-6"
        >
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Available quick actions</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {QUICK_ACTIONS.map((action) => (
              <div
                key={action.id}
                className="rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] p-4"
              >
                <p className="text-xs font-bold uppercase tracking-wide text-primary">
                  {action.id}
                </p>
                <h3 className="mt-1 text-lg font-semibold">{action.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
                  {action.useCase}
                </p>
              </div>
            ))}
          </div>
        </article>

        <article
          id="editable"
          className="mt-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 sm:p-6"
        >
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            Editable vs non-editable text behavior
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] p-4">
              <h3 className="text-lg font-semibold">Editable fields</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
                In inputs, textareas, and editable editors, quick action output can be used as
                replacement text.
              </p>
              <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>Use text replacement behavior: ask, auto, or copy only.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>Smart Translation uses target language for writing output.</span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] p-4">
              <h3 className="text-lg font-semibold">Non-editable text</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
                On static text blocks, quick actions return processed content without direct
                in-place replacement.
              </p>
              <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>Smart Translation uses native language for reading.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>You can send that same selection to chat for deeper help.</span>
                </li>
              </ul>
            </div>
          </div>
        </article>

        <article
          id="add-to-chat"
          className="mt-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 sm:p-6"
        >
          <h2 className="inline-flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Add to chat from selection
          </h2>
          <ol className="mt-4 space-y-3 text-sm text-[var(--muted)] sm:text-base">
            <li className="rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] p-4">
              1. Select text on any webpage.
            </li>
            <li className="rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] p-4">
              2. Click the chat action in the selection toolbar.
            </li>
            <li className="rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] p-4">
              3. The selected text is inserted into your chat draft so you can continue with custom
              prompts.
            </li>
          </ol>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/docs/chat"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
            >
              Continue to Chat Workflow
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/docs/settings"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--section-alt)] px-4 py-2.5 text-sm font-semibold text-[var(--muted)] transition-colors hover:text-primary"
            >
              Configure Quick Action Settings
            </Link>
          </div>
        </article>
      </section>
    </>
  );
}
