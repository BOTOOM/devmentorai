import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  TerminalSquare,
} from "lucide-react";
import { HeroSection } from "@/components/sections/HeroSection";
import { Badge } from "@/components/ui/Badge";
import { CodeBlock } from "@/components/ui/CodeBlock";

const SITE_URL = "https://devmentorai.edwardiaz.dev";
const PAGE_PATH = "/docs/get-started/copilot-cli";
const PAGE_URL = `${SITE_URL}${PAGE_PATH}`;

const OFFICIAL_INSTALL_DOCS =
  "https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli";
const OFFICIAL_COPILOT_DOCS = "https://docs.github.com/en/copilot";

const PAGE_TITLE = "Install and Login Copilot CLI for DevMentorAI";
const PAGE_DESCRIPTION =
  "Step-by-step Copilot CLI setup for DevMentorAI: install command, login flow, quota notes, and what to run next.";

const OS_INSTALL_REFERENCES = [
  {
    label: "macOS install options",
    href: OFFICIAL_INSTALL_DOCS,
  },
  {
    label: "Linux install options",
    href: OFFICIAL_INSTALL_DOCS,
  },
  {
    label: "Windows install options",
    href: OFFICIAL_INSTALL_DOCS,
  },
] as const;

export const metadata: Metadata = {
  title: "Docs: Copilot CLI Setup",
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

export default function CopilotCliDocsPage() {
  const howToJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "HowTo",
        name: PAGE_TITLE,
        description: PAGE_DESCRIPTION,
        totalTime: "PT7M",
        supply: [
          { "@type": "HowToSupply", name: "Node.js 20+" },
          { "@type": "HowToSupply", name: "Terminal access" },
        ],
        step: [
          {
            "@type": "HowToStep",
            name: "Install Copilot CLI",
            text: "Install globally with npm: npm install -g @github/copilot-cli",
            url: OFFICIAL_INSTALL_DOCS,
          },
          {
            "@type": "HowToStep",
            name: "Start interactive login",
            text: "Run copilot, then run /login in the interactive prompt.",
          },
          {
            "@type": "HowToStep",
            name: "Follow terminal instructions",
            text: "Complete browser/device authorization and confirm success.",
          },
          {
            "@type": "HowToStep",
            name: "Start DevMentorAI backend",
            text: "Run npx devmentorai-server after successful login.",
            url: `${SITE_URL}/installation`,
          },
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
            name: "Get Started",
            item: `${SITE_URL}/docs/get-started`,
          },
          {
            "@type": "ListItem",
            position: 4,
            name: "Copilot CLI",
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
        badge={
          <Badge icon={<TerminalSquare className="h-3 w-3" />}>
            Copilot CLI Guide
          </Badge>
        }
        title={
          <>
            Install and login to <span className="text-primary">Copilot CLI</span>
          </>
        }
        subtitle="DevMentorAI backend commands rely on an authenticated Copilot CLI session. Complete this once, then continue with installation."
      />

      <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6 md:pb-24">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <article className="rounded-2xl border border-amber-300/40 bg-amber-100/40 p-5 sm:p-6">
            <h2 className="inline-flex items-center gap-2 text-lg font-bold sm:text-xl">
              <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-300" />
              Quick Summary
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-[var(--foreground)] sm:text-base">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
                Install Copilot CLI first.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
                Run <code className="rounded bg-black/10 px-1.5 py-0.5 font-mono text-xs">copilot</code> and then <code className="rounded bg-black/10 px-1.5 py-0.5 font-mono text-xs">/login</code>.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
                After successful login, run <code className="rounded bg-black/10 px-1.5 py-0.5 font-mono text-xs">npx devmentorai-server</code>.
              </li>
            </ul>
          </article>

          <aside className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 sm:p-6">
            <p className="text-sm font-semibold">On this page</p>
            <nav aria-label="Copilot CLI table of contents" className="mt-3 space-y-2 text-sm">
              <a href="#why" className="block rounded-md px-2 py-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--section-alt)] hover:text-primary">
                Why it is required
              </a>
              <a href="#install" className="block rounded-md px-2 py-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--section-alt)] hover:text-primary">
                Install command
              </a>
              <a href="#login" className="block rounded-md px-2 py-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--section-alt)] hover:text-primary">
                Login steps
              </a>
              <a href="#quota" className="block rounded-md px-2 py-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--section-alt)] hover:text-primary">
                Quota and subscriptions
              </a>
            </nav>
          </aside>
        </div>

        <article id="why" className="mt-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 sm:p-6">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Why Copilot CLI is required</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
            DevMentorAI backend uses your Copilot CLI authentication context. If Copilot CLI is missing or not logged in, backend responses can be limited or fail.
          </p>
        </article>

        <article id="install" className="mt-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 sm:p-6">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Install Copilot CLI</h2>
          <p className="mt-2 text-sm text-[var(--muted)] sm:text-base">
            Recommended method using npm:
          </p>
          <div className="mt-4">
            <CodeBlock code="npm install -g @github/copilot-cli" language="bash" />
          </div>

          <p className="mt-4 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
            For OS-specific alternatives, open the official installation guide and use the tab for your environment.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {OS_INSTALL_REFERENCES.map((reference) => (
              <li key={reference.label}>
                <a
                  href={reference.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--section-alt)] px-4 py-2.5 font-semibold text-[var(--foreground)] transition-colors hover:text-primary"
                >
                  {reference.label}
                  <ExternalLink className="h-4 w-4" />
                </a>
              </li>
            ))}
          </ul>
        </article>

        <article id="login" className="mt-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 sm:p-6">
          <h2 className="inline-flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
            <KeyRound className="h-5 w-5 text-primary" />
            Login step-by-step
          </h2>

          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-primary">Step 1</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Open Copilot CLI interactive mode.</p>
              <div className="mt-3">
                <CodeBlock code="copilot" language="bash" />
              </div>
            </div>

            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-primary">Step 2</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Inside the interactive prompt, run:</p>
              <div className="mt-3">
                <CodeBlock code="/login" language="bash" />
              </div>
            </div>

            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-primary">Step 3</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Follow the terminal instructions and complete authorization in your browser.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <CodeBlock code="npx devmentorai-server" language="bash" />
          </div>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Run the backend command only after login success.
          </p>
        </article>

        <article id="quota" className="mt-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 sm:p-6">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Quota and subscription note</h2>
          <div className="mt-3 rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] p-4 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
            <p>
              If you do not have a paid Copilot subscription, Copilot generally includes a limited monthly premium request quota (commonly referenced as 50 premium requests/month).
            </p>
            <p className="mt-2">
              If you have a paid subscription, limits and model access depend on your current Copilot plan.
            </p>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
            To switch account or manage plan behavior, use terminal auth commands and review the official Copilot documentation.
          </p>
          <a
            href={OFFICIAL_COPILOT_DOCS}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--section-alt)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:text-primary"
          >
            Open official Copilot docs
            <ExternalLink className="h-4 w-4" />
          </a>
        </article>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/installation"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
          >
            Continue to Installation
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/docs/get-started"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--section-alt)] px-4 py-2.5 text-sm font-semibold text-[var(--muted)] transition-colors hover:text-primary"
          >
            Back to Get Started
          </Link>
        </div>
      </section>
    </>
  );
}
