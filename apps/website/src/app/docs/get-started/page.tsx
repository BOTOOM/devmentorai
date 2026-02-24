import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardList, Rocket } from "lucide-react";
import { HeroSection } from "@/components/sections/HeroSection";
import { Badge } from "@/components/ui/Badge";
import { CodeBlock } from "@/components/ui/CodeBlock";

const SITE_URL = "https://devmentorai.edwardiaz.dev";
const PAGE_PATH = "/docs/get-started";
const PAGE_URL = `${SITE_URL}${PAGE_PATH}`;

const PAGE_TITLE = "Get Started with DevMentorAI";
const PAGE_DESCRIPTION =
  "Get started quickly with DevMentorAI: prerequisites, Copilot CLI setup, extension installation, and first chat session flow.";

const PREREQUISITES = [
  "Node.js 20+ installed on your machine.",
  "DevMentorAI browser extension downloaded from the latest release.",
  "GitHub Copilot CLI installed and authenticated.",
  "Local backend command available: npx devmentorai-server.",
] as const;

const STARTUP_STEPS = [
  {
    title: "Install and login to Copilot CLI",
    description:
      "If Copilot CLI is not ready, complete that first. The backend command depends on an authenticated Copilot CLI session.",
    href: "/docs/get-started/copilot-cli",
    cta: "Open Copilot CLI guide",
  },
  {
    title: "Start the local backend",
    description:
      "Run the backend command in your terminal and keep the process running while using the extension.",
    href: "/installation",
    cta: "Open installation page",
  },
  {
    title: "Load the extension and open a session",
    description:
      "Open DevMentorAI from your browser toolbar, create a new session, and send your first prompt.",
    href: "/docs/chat",
    cta: "Read chat workflow",
  },
] as const;

export const metadata: Metadata = {
  title: "Docs: Get Started",
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

export default function DocsGetStartedPage() {
  const howToJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "HowTo",
        name: PAGE_TITLE,
        description: PAGE_DESCRIPTION,
        totalTime: "PT5M",
        step: [
          {
            "@type": "HowToStep",
            name: "Install and login to Copilot CLI",
            url: `${SITE_URL}/docs/get-started/copilot-cli`,
          },
          {
            "@type": "HowToStep",
            name: "Run backend command",
            text: "Run npx devmentorai-server in your terminal.",
            url: `${SITE_URL}/installation`,
          },
          {
            "@type": "HowToStep",
            name: "Open extension and start chat",
            url: `${SITE_URL}/docs/chat`,
          },
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: SITE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Docs",
            item: `${SITE_URL}/docs`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: "Get Started",
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />

      <HeroSection
        badge={<Badge icon={<Rocket className="h-3 w-3" />}>Get Started</Badge>}
        title={
          <>
            Set up DevMentorAI in <span className="text-primary">a clear order</span>
          </>
        }
        subtitle="This page gives you a fast onboarding path with the exact prerequisite sequence to avoid setup failures."
      />

      <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6 md:pb-24">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--section-alt)] p-5 sm:p-6">
            <h2 className="text-lg font-bold sm:text-xl">Quick Summary</h2>
            <ul className="mt-3 space-y-2 text-sm text-[var(--muted)] sm:text-base">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Copilot CLI must be installed and authenticated before backend startup.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Keep backend running while using the extension.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Use docs sections as your operational playbook.
              </li>
            </ul>
          </article>

          <aside className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 sm:p-6">
            <p className="text-sm font-semibold">On this page</p>
            <nav aria-label="Get started table of contents" className="mt-3 space-y-2 text-sm">
              <a href="#prerequisites" className="block rounded-md px-2 py-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--section-alt)] hover:text-primary">
                Prerequisites
              </a>
              <a href="#flow" className="block rounded-md px-2 py-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--section-alt)] hover:text-primary">
                Startup flow
              </a>
              <a href="#next" className="block rounded-md px-2 py-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--section-alt)] hover:text-primary">
                Next docs
              </a>
            </nav>
          </aside>
        </div>

        <article id="prerequisites" className="mt-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 sm:p-6">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Prerequisites checklist</h2>
          <ul className="mt-4 space-y-2 text-sm text-[var(--muted)] sm:text-base">
            {PREREQUISITES.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <CodeBlock code="npx devmentorai-server" language="bash" />
          </div>
        </article>

        <article id="flow" className="mt-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 sm:p-6">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Startup flow</h2>
          <div className="mt-4 space-y-4">
            {STARTUP_STEPS.map((step, index) => (
              <div
                key={step.title}
                className="rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] p-4"
              >
                <p className="text-xs font-bold uppercase tracking-wide text-primary">
                  Step {index + 1}
                </p>
                <h3 className="mt-1 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
                  {step.description}
                </p>
                <Link
                  href={step.href}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
                >
                  {step.cta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </article>

        <article id="next" className="mt-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 sm:p-6">
          <h2 className="inline-flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
            <ClipboardList className="h-5 w-5 text-primary" />
            Continue with these docs
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link
              href="/docs/quick-actions"
              className="rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition-colors hover:border-primary/40"
            >
              Quick Actions usage
            </Link>
            <Link
              href="/docs/chat"
              className="rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition-colors hover:border-primary/40"
            >
              Chat workflow
            </Link>
            <Link
              href="/docs/settings"
              className="rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition-colors hover:border-primary/40"
            >
              Settings map
            </Link>
            <Link
              href="/installation"
              className="rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition-colors hover:border-primary/40"
            >
              Installation page
            </Link>
          </div>
        </article>
      </section>
    </>
  );
}
