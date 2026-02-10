import type { Metadata } from "next";
import {
  Shield,
  Terminal,
  Key,
  MousePointerClick,
  Lock,
  CheckCircle,
  CloudOff,
  MonitorSmartphone,
  Cpu,
  Server,
} from "lucide-react";
import { HeroSection } from "@/components/sections/HeroSection";
import { CTASection } from "@/components/sections/CTASection";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "Trust & Privacy",
  description:
    "DevMentorAI is privacy-first and local by design. No cloud storage, no credential retention. Your data stays on your machine.",
};

export default function TrustPage() {
  return (
    <>
      {/* Hero */}
      <HeroSection
        badge={
          <Badge icon={<Shield className="h-3 w-3" />}>
            Security Verified
          </Badge>
        }
        title={
          <>
            Privacy first.
            <br />
            <span className="text-primary">Local by design.</span>
          </>
        }
        subtitle="DevMentorAI acts as a secure bridge, not a storage unit. Your proprietary code and credentials never touch our servers."
      />

      {/* Architecture Diagram */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-2xl font-bold md:text-3xl">
            How Your Data Flows
          </h2>
          <p className="mx-auto max-w-xl text-[var(--muted)]">
            Visualizing the local-first architecture that keeps your workspace
            isolated.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-8 shadow-lg backdrop-blur-xl md:p-12">
          <div className="absolute inset-0 -z-10 bg-primary/5" />

          {/* 4-node flow: Extension → Server → Copilot CLI → LLM */}
          <div className="grid grid-cols-1 items-center gap-6 text-center md:grid-cols-7">
            {/* 1. Extension */}
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] text-primary">
                <MonitorSmartphone className="h-8 w-8" />
              </div>
              <div>
                <h3 className="font-bold">Extension</h3>
                <p className="text-xs text-[var(--muted)]">DOM & Context</p>
              </div>
            </div>

            {/* Connector 1 */}
            <div className="hidden flex-col items-center justify-center gap-2 md:flex">
              <span className="text-[10px] font-bold text-[var(--muted)]">
                HTTP / SSE
              </span>
              <div className="h-px w-full bg-gradient-to-r from-primary to-primary/30" />
            </div>

            {/* 2. Local Server */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-xl border border-primary/30 bg-primary-light text-primary">
                <Server className="h-8 w-8" />
                <span className="absolute -bottom-2 rounded bg-primary/80 px-1.5 py-0.5 text-[8px] font-black text-white">
                  :3847
                </span>
              </div>
              <div>
                <h3 className="font-bold">Local Server</h3>
                <p className="text-xs text-[var(--muted)]">Fastify + SQLite</p>
              </div>
            </div>

            {/* Connector 2 */}
            <div className="hidden flex-col items-center justify-center gap-2 md:flex">
              <span className="text-[10px] font-bold text-[var(--muted)]">
                JSON-RPC
              </span>
              <div className="h-px w-full bg-gradient-to-r from-primary/30 to-amber-500/50" />
            </div>

            {/* 3. Copilot CLI — central secure boundary */}
            <div className="relative flex flex-col items-center gap-4 rounded-2xl border-2 border-primary/40 bg-primary-light p-6 shadow-xl shadow-primary/10">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded bg-primary px-2 py-0.5 text-[10px] font-black uppercase text-white">
                Secure Boundary
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-lg">
                <Terminal className="h-8 w-8" />
              </div>
              <div>
                <h3 className="font-bold">Copilot CLI</h3>
                <p className="text-xs font-medium text-primary/80">
                  Auth & Processing
                </p>
              </div>
            </div>

            {/* Connector 3 */}
            <div className="hidden flex-col items-center justify-center gap-2 md:flex">
              <span className="text-[10px] font-bold text-[var(--muted)]">
                ENCRYPTED API
              </span>
              <div className="h-px w-full bg-gradient-to-l from-emerald-500 to-amber-500/50" />
            </div>

            {/* 4. LLM Provider */}
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] text-emerald-500">
                <Cpu className="h-8 w-8" />
              </div>
              <div>
                <h3 className="font-bold">LLM Provider</h3>
                <p className="text-xs text-[var(--muted)]">GitHub Copilot</p>
              </div>
            </div>
          </div>

          {/* Mobile flow (visible on small screens) */}
          <div className="mt-6 flex items-center justify-center gap-2 text-xs font-bold text-[var(--muted)] md:hidden">
            <span>Extension</span>
            <span className="text-primary">→</span>
            <span>Server</span>
            <span className="text-primary">→</span>
            <span>Copilot CLI</span>
            <span className="text-primary">→</span>
            <span>LLM</span>
          </div>

          {/* No Cloud Storage banner */}
          <div className="mt-16 flex flex-col items-center border-t border-[var(--card-border)] pt-8">
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-rose-500">
              <CloudOff className="h-4 w-4" />
              <span className="text-sm font-bold uppercase tracking-widest">
                No DevMentorAI Cloud Storage
              </span>
            </div>
            <p className="max-w-lg text-center text-sm text-[var(--muted)]">
              We never receive your source code, environment variables, or
              secrets. Everything runs locally on your machine. The Copilot
              CLI communicates directly with GitHub&apos;s LLM via encrypted
              channels.
            </p>
          </div>
        </div>
      </section>

      {/* Trust Cards Grid */}
      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 pb-24 md:grid-cols-2">
        <TrustCard
          icon={<Cpu className="h-6 w-6" />}
          title="Powered by your local Copilot CLI"
          description="No data leaves your machine to reach our servers. All heavy lifting, parsing, and context generation happens within your own local runtime environment."
        />
        <TrustCard
          icon={<Key className="h-6 w-6" />}
          title="No Credential Storage"
          description="We use your existing GitHub authentication. We never see, store, or transmit your passwords or API keys to any third-party databases."
        />
        <TrustCard
          icon={<MousePointerClick className="h-6 w-6" />}
          title="User-Controlled Data"
          description="You choose exactly when to capture a screenshot or DOM state. Nothing is automated behind the scenes without your explicit user-initiated command."
        />
        <TrustCard
          icon={<Lock className="h-6 w-6" />}
          title="Authenticated Page Support"
          description="Works safely on private dashboards and internal tools because the context remains entirely within your local browser session and CLI."
        />
      </section>

      {/* Transparency Section */}
      <section className="mx-auto flex max-w-6xl flex-col items-center gap-12 px-4 pb-24 md:flex-row">
        <div className="flex-1">
          <h2 className="mb-6 text-3xl font-bold">
            Engineered for Transparency
          </h2>
          <p className="mb-6 leading-relaxed text-[var(--muted)]">
            We believe trust is earned through transparency. That&apos;s why the
            DevMentorAI core bridge is built on top of the open-source Copilot
            CLI infrastructure.
          </p>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <CheckCircle className="mt-1 h-5 w-5 text-emerald-500" />
              <span>Direct GitHub Authentication flow</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="mt-1 h-5 w-5 text-emerald-500" />
              <span>No middleware proxy for LLM requests</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="mt-1 h-5 w-5 text-emerald-500" />
              <span>Audit-friendly local logs</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="mt-1 h-5 w-5 text-emerald-500" />
              <span>Automatic redaction of tokens, API keys, and passwords</span>
            </li>
          </ul>
          <div className="mt-8">
            <a
              href="https://github.com/BOTOOM/devmentorai/blob/master/docs/ARCHITECTURE.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-bold text-primary hover:underline"
            >
              Read the Technical Documentation →
            </a>
          </div>
        </div>
        <div className="flex flex-1 justify-center">
          <div className="flex h-48 w-48 items-center justify-center rounded-2xl border border-[var(--card-border)] bg-[var(--card)] shadow-2xl">
            <Shield className="h-24 w-24 text-primary/20" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <CTASection
        title="Ready to work securely?"
        subtitle="Join developers building the future without compromising their data sovereignty."
        primaryLabel="Get Started for Free"
        primaryHref="/installation"
      />
    </>
  );
}

function TrustCard({
  icon,
  title,
  description,
}: Readonly<{
  icon: React.ReactNode;
  title: string;
  description: string;
}>) {
  return (
    <div className="flex gap-6 rounded-xl border border-[var(--card-border)] border-l-4 border-l-primary bg-[var(--card)] p-8 backdrop-blur-xl">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
        {icon}
      </div>
      <div>
        <h3 className="mb-2 text-xl font-bold">{title}</h3>
        <p className="leading-relaxed text-[var(--muted)]">{description}</p>
      </div>
    </div>
  );
}
