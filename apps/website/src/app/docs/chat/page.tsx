import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ImagePlus,
  Layers3,
  MessageSquare,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { HeroSection } from "@/components/sections/HeroSection";
import { Badge } from "@/components/ui/Badge";

const SITE_URL = "https://devmentorai.edwardiaz.dev";
const PAGE_PATH = "/docs/chat";
const PAGE_URL = `${SITE_URL}${PAGE_PATH}`;

const PAGE_TITLE = "DevMentorAI Chat Workflow Guide";
const PAGE_DESCRIPTION =
  "Create sessions, choose models by pricing tier, attach images, use context mode, and chat effectively in DevMentorAI.";

const SESSION_TYPES = [
  {
    id: "devops",
    title: "DevOps",
    details: "Cloud, Kubernetes, CI/CD, infrastructure and operational troubleshooting.",
  },
  {
    id: "writing",
    title: "Writing",
    details: "Emails, rewriting, translation, and grammar-oriented tasks.",
  },
  {
    id: "development",
    title: "Development",
    details: "Code review, debugging, architecture, and implementation guidance.",
  },
  {
    id: "general",
    title: "General",
    details: "Broad conversations and mixed non-specialized requests.",
  },
] as const;

const MODEL_TIERS = [
  "free",
  "cheap",
  "standard",
  "premium",
] as const;

export const metadata: Metadata = {
  title: "Docs: Chat Workflow",
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: PAGE_PATH,
  },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

export default function DocsChatPage() {
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        headline: PAGE_TITLE,
        description: PAGE_DESCRIPTION,
        url: PAGE_URL,
        about: [
          "Session creation",
          "Model selection",
          "Context mode",
          "Image attachments",
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          {
            "@type": "ListItem",
            position: 2,
            name: "Docs",
            item: `${SITE_URL}/docs`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: "Chat Workflow",
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
        badge={<Badge icon={<MessageSquare className="h-3 w-3" />}>Chat Workflow</Badge>}
        title={
          <>
            Build better conversations with <span className="text-primary">structured sessions</span>
          </>
        }
        subtitle="Use session types, model tiers, and context/image features to get answers that are faster and more relevant."
      />

      <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6 md:pb-24">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--section-alt)] p-5 sm:p-6">
            <h2 className="text-lg font-bold sm:text-xl">Quick Summary</h2>
            <ul className="mt-3 space-y-2 text-sm text-[var(--muted)] sm:text-base">
              <li>Create a new session with name, type, and model before sending messages.</li>
              <li>Model options are grouped by pricing tier: free, cheap, standard, premium.</li>
              <li>Context mode plus screenshot/image inputs can improve response quality.</li>
            </ul>
          </article>

          <aside className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 sm:p-6">
            <p className="text-sm font-semibold">On this page</p>
            <nav aria-label="Chat docs table of contents" className="mt-3 space-y-2 text-sm">
              <a href="#new-session" className="block rounded-md px-2 py-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--section-alt)] hover:text-primary">
                New session flow
              </a>
              <a href="#types" className="block rounded-md px-2 py-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--section-alt)] hover:text-primary">
                Session types
              </a>
              <a href="#models" className="block rounded-md px-2 py-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--section-alt)] hover:text-primary">
                Model tiers
              </a>
              <a href="#attachments" className="block rounded-md px-2 py-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--section-alt)] hover:text-primary">
                Images and context
              </a>
            </nav>
          </aside>
        </div>

        <article id="new-session" className="mt-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 sm:p-6">
          <h2 className="inline-flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
            <Layers3 className="h-5 w-5 text-primary" />
            New session flow
          </h2>

          <ol className="mt-4 space-y-3 text-sm text-[var(--muted)] sm:text-base">
            <li className="rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] p-4">
              1. Click <strong className="text-[var(--foreground)]">New</strong> in the extension header.
            </li>
            <li className="rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] p-4">
              2. Enter a session name that reflects your task.
            </li>
            <li className="rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] p-4">
              3. Choose one of the four session types.
            </li>
            <li className="rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] p-4">
              4. Select the model and create the session.
            </li>
          </ol>
        </article>

        <article id="types" className="mt-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 sm:p-6">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Session types</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {SESSION_TYPES.map((sessionType) => (
              <div
                key={sessionType.id}
                className="rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] p-4"
              >
                <p className="text-xs font-bold uppercase tracking-wide text-primary">
                  {sessionType.id}
                </p>
                <h3 className="mt-1 text-lg font-semibold">{sessionType.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
                  {sessionType.details}
                </p>
              </div>
            ))}
          </div>
        </article>

        <article id="models" className="mt-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 sm:p-6">
          <h2 className="inline-flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            Model selection by pricing tier
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
            In the model picker, models are grouped by pricing tier in this order:
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {MODEL_TIERS.map((tier) => (
              <span
                key={tier}
                className="rounded-full border border-[var(--card-border)] bg-[var(--section-alt)] px-3 py-1.5 font-semibold"
              >
                {tier}
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
            Recommendation: start with free models for most tasks and move to advanced tiers only when complexity requires it.
          </p>
        </article>

        <article id="attachments" className="mt-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 sm:p-6">
          <h2 className="inline-flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
            <ImagePlus className="h-5 w-5 text-primary" />
            Messages, images, and context mode
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] p-4">
              <h3 className="text-lg font-semibold">Image input options</h3>
              <ul className="mt-2 space-y-2 text-sm text-[var(--muted)] sm:text-base">
                <li>Attach with the image button.</li>
                <li>Paste images directly into chat.</li>
                <li>Drag and drop images into the input area.</li>
              </ul>
            </div>

            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] p-4">
              <h3 className="text-lg font-semibold">Context mode and screenshots</h3>
              <ul className="mt-2 space-y-2 text-sm text-[var(--muted)] sm:text-base">
                <li>Toggle context mode to analyze the active page.</li>
                <li>Context can include URL, selection, headings, and detected product context.</li>
                <li>Screenshot capture can be disabled, ask, or auto depending on settings.</li>
              </ul>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] p-4 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
            You can also send selected browser text to chat with the selection toolbar action and continue from there with custom prompts.
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/docs/settings"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
            >
              Configure Chat-Related Settings
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/docs/quick-actions"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--section-alt)] px-4 py-2.5 text-sm font-semibold text-[var(--muted)] transition-colors hover:text-primary"
            >
              Review Quick Actions
            </Link>
          </div>
        </article>

        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card)] px-3 py-1.5 text-xs text-[var(--muted)]">
          <Sparkles className="h-3.5 w-3.5" />
          Tip: keep one session per topic to preserve cleaner context and better responses.
        </div>
      </section>
    </>
  );
}
