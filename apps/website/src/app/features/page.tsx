import type { Metadata } from "next";
import {
  Eye,
  Terminal,
  FileEdit,
  ShieldCheck,
  MessageSquare,
  CheckCircle,
  Cloud,
  Cpu,
  Bug,
  Layers,
} from "lucide-react";
import { HeroSection } from "@/components/sections/HeroSection";
import { CTASection } from "@/components/sections/CTASection";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Full page awareness, DevOps mentoring, writing assistance, and privacy-first architecture. Explore all DevMentorAI capabilities.",
};

export default function FeaturesPage() {
  return (
    <>
      {/* Hero */}
      <HeroSection
        badge={<Badge>Powerful Capabilities</Badge>}
        title={
          <>
            Engineered for the modern{" "}
            <span className="text-primary">DevOps stack.</span>
          </>
        }
        subtitle="Everything you need to debug, deploy, and document complex distributed systems without ever leaving your workflow."
      />

      {/* Section 1: Full Page Awareness */}
      <section className="border-t border-[var(--card-border)] py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 md:grid-cols-2">
          {/* Visual */}
          <div className="order-2 md:order-1">
            <div className="relative overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--code-bg)] p-2 shadow-2xl">
              <div className="flex items-center gap-2 rounded-t-lg border-b border-white/5 bg-slate-800/50 px-3 py-2">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500/50" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-500/50" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/50" />
                </div>
                <div className="ml-4 font-mono text-[10px] text-slate-500">
                  dev-console // analysis-mode
                </div>
              </div>
              <div className="space-y-4 overflow-hidden bg-[var(--code-bg)] p-6">
                <div className="flex animate-pulse items-center gap-4">
                  <div className="h-2 w-32 rounded bg-primary/40" />
                  <div className="h-2 w-full rounded bg-white/10" />
                </div>
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <p className="mb-2 font-mono text-[12px] text-primary">
                    SCANNING DOM STRUCTURE...
                  </p>
                  <div className="space-y-2 opacity-60">
                    <div className="h-1.5 w-3/4 rounded bg-white/20" />
                    <div className="h-1.5 w-1/2 rounded bg-white/20" />
                    <div className="h-1.5 w-5/6 rounded bg-white/20" />
                  </div>
                </div>
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                  <p className="font-mono text-[12px] text-red-400">
                    404 NOT FOUND: /api/v1/user/auth
                  </p>
                  <p className="text-[10px] text-red-400/60">
                    Source: network-logs.js line 42
                  </p>
                </div>
              </div>
            </div>
          </div>
          {/* Text */}
          <div className="order-1 md:order-2">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light text-primary">
              <Eye className="h-6 w-6" />
            </div>
            <h2 className="mb-6 text-3xl font-bold">Full Page Awareness</h2>
            <p className="mb-6 text-lg leading-relaxed text-[var(--muted)]">
              Stop explaining context to your AI. DevMentorAI automatically
              captures your application&apos;s state, giving your Copilot eyes
              into the front-end.
            </p>
            <ul className="space-y-4">
              <FeatureItem
                icon={<CheckCircle className="h-5 w-5 text-emerald-500" />}
                title="DOM Structure Tracking"
                description="Understands component nesting and styling contexts."
              />
              <FeatureItem
                icon={<CheckCircle className="h-5 w-5 text-emerald-500" />}
                title="Live Network Logs"
                description="Inspects failed API calls and payload mismatches."
              />
              <FeatureItem
                icon={<CheckCircle className="h-5 w-5 text-emerald-500" />}
                title="JS Error Tracking"
                description="Automatically attaches stack traces to your prompts."
              />
            </ul>
          </div>
        </div>
      </section>

      {/* Section 2: DevOps Mentor Mode */}
      <section className="bg-[var(--section-alt)] py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 md:grid-cols-2">
          <div>
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <Terminal className="h-6 w-6" />
            </div>
            <h2 className="mb-6 text-3xl font-bold">DevOps Mentor Mode</h2>
            <p className="mb-6 text-lg leading-relaxed text-[var(--muted)]">
              Infrastructure is hard. DevMentorAI acts as a senior SRE sitting
              next to you, providing specialized knowledge across the entire
              cloud landscape.
            </p>
            <div className="mb-8 grid grid-cols-3 gap-4">
              <PlatformBadge icon={<Cloud className="h-5 w-5 text-blue-400" />} label="Azure" />
              <PlatformBadge icon={<Cpu className="h-5 w-5 text-orange-400" />} label="AWS" />
              <PlatformBadge icon={<Layers className="h-5 w-5 text-blue-500" />} label="K8s" />
            </div>
          </div>
          {/* Terminal visual */}
          <div className="relative">
            <div className="overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--code-bg)] font-mono text-sm leading-relaxed shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/5 bg-[#1c2128] px-4 py-2">
                <span className="text-xs text-slate-400">
                  DevMentorAI — devops-session
                </span>
              </div>
              <div className="space-y-4 p-6">
                {/* User message */}
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-600 text-[10px] font-bold text-white">
                    U
                  </div>
                  <div className="rounded-lg bg-slate-800 p-3 text-xs text-slate-300">
                    Why is my pod crashing? I see CrashLoopBackOff on the K8s dashboard.
                  </div>
                </div>
                {/* Flow indicator */}
                <div className="flex items-center gap-2 px-9 text-[10px] text-slate-500">
                  <span>Extension</span>
                  <span className="text-primary">→</span>
                  <span>Server</span>
                  <span className="text-primary">→</span>
                  <span>Copilot CLI</span>
                  <span className="text-primary">→</span>
                  <span>LLM</span>
                </div>
                {/* AI response */}
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                    AI
                  </div>
                  <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="text-xs text-slate-300">
                      Based on your K8s dashboard context, I can see:
                    </p>
                    <div className="border-l-2 border-red-500 bg-red-500/10 p-2">
                      <p className="text-[11px] font-bold text-red-400">
                        Memory Leak Detected
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Pod &apos;auth-service-7f4b&apos; is at 94% memory.
                        Recommend increasing limits or running heap analysis.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Writing & Language */}
      <section className="border-t border-[var(--card-border)] py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 md:grid-cols-2">
          {/* Visual */}
          <div className="order-2 md:order-1">
            <div className="overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--card)] shadow-2xl">
              <div className="space-y-4 bg-[var(--code-bg)] p-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                      AI
                    </div>
                    <span className="text-xs font-medium text-slate-300">
                      Drafting PR Description...
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Slack | Email | GitHub
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="h-4 w-full rounded bg-primary/20" />
                  <div className="h-4 w-5/6 rounded bg-white/5" />
                  <div className="h-4 w-4/6 rounded bg-white/5" />
                  <div className="space-y-2 border-t border-white/5 pt-4">
                    <div className="flex items-center gap-2">
                      <FileEdit className="h-3 w-3 text-primary" />
                      <span className="text-[11px] italic text-slate-400">
                        &quot;Client-ready update drafted&quot;
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-3 w-3 text-primary" />
                      <span className="text-[11px] italic text-slate-400">
                        &quot;Slack summary generated&quot;
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Text */}
          <div className="order-1 md:order-2">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
              <FileEdit className="h-6 w-6" />
            </div>
            <h2 className="mb-6 text-3xl font-bold">Writing & Language</h2>
            <p className="mb-8 text-lg leading-relaxed text-[var(--muted)]">
              Technical communication is just as important as code. Generate PR
              descriptions, stakeholder emails, and Slack status updates in
              seconds.
            </p>
            <div className="space-y-6">
              <FeatureItem
                icon={<FileEdit className="h-5 w-5 text-primary" />}
                title="PR Descriptions"
                description="Automatically summarizes file changes and tests run."
              />
              <FeatureItem
                icon={<MessageSquare className="h-5 w-5 text-primary" />}
                title="Technical Emails"
                description="Transform cryptic logs into clear reports for management."
              />
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Local & Private */}
      <section className="bg-primary-light py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid items-center gap-16 md:grid-cols-2">
            <div>
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h2 className="mb-6 text-3xl font-bold">Local & Private</h2>
              <p className="mb-6 text-lg leading-relaxed text-[var(--muted)]">
                Security isn&apos;t an afterthought. DevMentorAI leverages the
                GitHub Copilot CLI for local processing, ensuring your sensitive
                data never leaves your machine.
              </p>
              <div className="flex flex-wrap gap-3">
                <span className="rounded-full border border-[var(--card-border)] bg-[var(--card)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
                  Local-First
                </span>
                <span className="rounded-full border border-[var(--card-border)] bg-[var(--card)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
                  No Credential Storage
                </span>
                <span className="rounded-full border border-[var(--card-border)] bg-[var(--card)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
                  Zero Data Retention
                </span>
              </div>
            </div>
            <div className="flex justify-center">
              <div className="relative flex h-64 w-64 items-center justify-center">
                <div className="absolute inset-0 animate-[spin_20s_linear_infinite] rounded-full border-4 border-dashed border-[var(--card-border)]" />
                <div className="absolute inset-4 rounded-full border border-primary/20" />
                <div className="relative z-10 flex flex-col items-center rounded-3xl border border-[var(--card-border)] bg-[var(--background)] p-8 shadow-2xl">
                  <Terminal className="mb-4 h-12 w-12 text-primary" />
                  <p className="text-sm font-bold">Local Engine</p>
                  <p className="font-mono text-[10px] text-[var(--muted)]">
                    127.0.0.1:3847
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: Multi-Session */}
      <section className="border-t border-[var(--card-border)] py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold">Multi-Session Support</h2>
            <p className="text-[var(--muted)]">
              Context-switching without the cognitive load. Keep track of dozens
              of debugging streams simultaneously.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
            <SessionCard
              icon={<Bug className="h-5 w-5 text-primary" />}
              title="Auth Flow Debug"
              time="2 minutes ago"
              active
            />
            <SessionCard
              icon={<Cloud className="h-5 w-5 text-slate-400" />}
              title="K8s Cluster Migration"
              time="4 hours ago"
              progress={60}
            />
            <SessionCard
              icon={<Cpu className="h-5 w-5 text-slate-400" />}
              title="API Optimization"
              time="Yesterday"
              progress={100}
            />
            <SessionCard
              icon={<Layers className="h-5 w-5 text-slate-400" />}
              title="UI Redesign"
              time="3 days ago"
              progress={100}
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <CTASection
        title="Ready to boost your engineering velocity?"
        subtitle="DevMentorAI is free and open source. Start using it today."
        primaryLabel="Get Started"
        primaryHref="/installation"
        secondaryLabel="View on GitHub"
        secondaryHref="https://github.com/BOTOOM/devmentorai"
      />
    </>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: Readonly<{
  icon: React.ReactNode;
  title: string;
  description: string;
}>) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-1">{icon}</span>
      <div>
        <span className="font-bold">{title}</span>
        <p className="text-sm text-[var(--muted)]">{description}</p>
      </div>
    </li>
  );
}

function PlatformBadge({
  icon,
  label,
}: Readonly<{ icon: React.ReactNode; label: string }>) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-3">
      {icon}
      <span className="text-xs font-bold uppercase tracking-tight text-[var(--muted)]">
        {label}
      </span>
    </div>
  );
}

function SessionCard({
  icon,
  title,
  time,
  active = false,
  progress,
}: Readonly<{
  icon: React.ReactNode;
  title: string;
  time: string;
  active?: boolean;
  progress?: number;
}>) {
  return (
    <div
      className={`cursor-pointer rounded-xl border p-5 transition-all ${
        active
          ? "border-primary/30 bg-[var(--card)] shadow-lg"
          : "border-[var(--card-border)] bg-[var(--card)] hover:border-primary/20"
      }`}
    >
      <div className="mb-4 flex items-center gap-3">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            active ? "bg-primary-light" : "bg-[var(--section-alt)]"
          }`}
        >
          {icon}
        </div>
        <div className="overflow-hidden">
          <h4 className="truncate text-sm font-bold">{title}</h4>
          <p className="text-[10px] text-[var(--muted)]">{time}</p>
        </div>
      </div>
      {progress !== undefined && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--section-alt)]">
          <div
            className="h-full rounded-full bg-slate-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
