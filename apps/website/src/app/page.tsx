import type { Metadata } from "next";
import Link from "next/link";
import { Globe, Cloud, FileEdit } from "lucide-react";
import { HeroSection } from "@/components/sections/HeroSection";
import { CTASection } from "@/components/sections/CTASection";
import { FeatureCard } from "@/components/ui/FeatureCard";
import { PulseBadge } from "@/components/ui/Badge";
import { LiteYouTubeEmbed } from "@/components/ui/LiteYouTubeEmbed";

export const metadata: Metadata = {
  title: "DevMentorAI — AI Mentor for Your Entire Browser",
  description:
    "Watch the DevMentorAI demo and learn how to install, connect, and use context-aware AI assistance in your browser with GitHub Copilot.",
};

export default function Home() {
  const videoJsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: "DevMentorAI Demo — Installation and Usage",
    description:
      "Full product demo showing DevMentorAI installation and real usage inside browser workflows.",
    thumbnailUrl: "https://i.ytimg.com/vi/Z_MnW1hJubM/hqdefault.jpg",
    uploadDate: "2026-02-20",
    embedUrl: "https://www.youtube.com/embed/Z_MnW1hJubM",
    contentUrl: "https://www.youtube.com/watch?v=Z_MnW1hJubM",
    publisher: {
      "@type": "Organization",
      name: "DevMentorAI",
      url: "https://devmentorai.edwardiaz.dev",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd) }}
      />

      {/* Hero */}
      <HeroSection
        badge={<PulseBadge>Powered by GitHub Copilot</PulseBadge>}
        title={
          <>
            The AI Mentor for your{" "}
            <span className="text-primary">entire browser</span>
          </>
        }
        subtitle="Context-aware assistance powered by GitHub Copilot. Understand any web page, error, or cloud dashboard instantly."
        actions={
          <>
            <Link
              href="/installation"
              className="flex w-full cursor-pointer items-center justify-center rounded-lg bg-primary px-8 py-4 text-base font-bold text-white shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] sm:min-w-[180px] sm:w-auto"
            >
              Get Started (Free)
            </Link>
            <a
              href="https://github.com/BOTOOM/devmentorai"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full cursor-pointer items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-8 py-4 text-base font-bold transition-all hover:border-primary/50 sm:min-w-[180px] sm:w-auto"
            >
              View on GitHub
            </a>
          </>
        }
      >
        {/* Browser Mockup */}
        <div className="mt-10 w-full max-w-[1000px] md:mt-16">
          <div className="relative overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] shadow-2xl">
            <div className="flex flex-col border border-slate-700 bg-slate-900 md:flex-row">
              {/* Browser bar */}
              <div className="flex w-full flex-col">
                <div className="flex h-10 items-center gap-2 border-b border-slate-700 bg-slate-800 px-4">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-red-500/50" />
                    <div className="h-3 w-3 rounded-full bg-yellow-500/50" />
                    <div className="h-3 w-3 rounded-full bg-green-500/50" />
                  </div>
                  <div className="mx-auto flex h-6 max-w-md flex-1 items-center rounded bg-slate-900/50 px-3 text-[10px] text-slate-500">
                    console.aws.amazon.com/ecs/v2/clusters
                  </div>
                </div>
                <div className="flex flex-1">
                  {/* AWS Console mockup */}
                  <div className="flex-1 space-y-4 p-4 opacity-40 sm:p-6">
                    <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
                      <div className="h-10 w-10 rounded-md bg-orange-500/20" />
                      <div className="h-4 w-48 rounded bg-slate-700" />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="h-24 rounded-lg bg-slate-800" />
                      <div className="h-24 rounded-lg bg-slate-800" />
                      <div className="h-24 rounded-lg bg-slate-800" />
                    </div>
                    <div className="space-y-2 pt-4">
                      <div className="h-3 w-full rounded bg-slate-800" />
                      <div className="h-3 w-4/5 rounded bg-slate-800" />
                      <div className="flex h-12 w-full items-center rounded border border-red-500/20 bg-red-900/20 px-4 text-xs text-red-400">
                        Error: Failed to pull image &quot;dev-api:latest&quot;.
                        Check IAM permissions.
                      </div>
                    </div>
                  </div>
                  {/* DevMentorAI Overlay */}
                  <div className="z-10 hidden w-72 flex-col gap-4 border-l border-slate-700 bg-slate-900/90 p-4 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] backdrop-blur-md md:flex">
                    <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                      <div className="h-4 w-4 rounded bg-primary" />
                      <span className="text-xs font-bold tracking-wide text-white">
                        DevMentorAI
                      </span>
                    </div>
                    <div className="rounded-lg border border-primary/20 bg-primary-light p-3">
                      <p className="text-[11px] leading-relaxed text-blue-100">
                        I see a{" "}
                        <span className="font-bold text-red-400">
                          CrashLoopBackOff
                        </span>
                        . The task role{" "}
                        <code className="text-primary">EcsTaskRole</code> is
                        missing the{" "}
                        <code className="text-primary">
                          ecr:GetDownloadUrlForLayer
                        </code>{" "}
                        permission.
                      </p>
                    </div>
                    <button className="rounded-md bg-primary py-2 text-[10px] font-bold text-white transition-colors hover:bg-primary-hover">
                      Apply IAM Fix via CLI
                    </button>
                    <div className="mt-auto border-t border-slate-800 pt-4">
                      <div className="flex h-8 items-center rounded-md bg-slate-800 px-3 text-[10px] text-slate-400">
                        Ask anything...
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </HeroSection>

      {/* Demo video */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 md:px-12 lg:px-20">
        <div className="mb-8 flex flex-col gap-3 text-center">
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl md:text-4xl">
            Watch the full demo in action
          </h2>
          <p className="mx-auto max-w-3xl text-sm leading-relaxed text-[var(--muted)] sm:text-base md:text-lg">
            See the complete flow: installation, first setup, and real-world usage across web pages and cloud dashboards.
          </p>
        </div>

        <LiteYouTubeEmbed
          videoId="Z_MnW1hJubM"
          title="DevMentorAI Demo — Installation and Real Usage"
        />
      </section>

      {/* Feature Grid */}
      <section className="bg-[var(--section-alt)] px-4 py-16 sm:px-6 md:px-12 md:py-20 lg:px-20">
        <div className="mx-auto max-w-[1200px]">
          <div className="mb-16 flex flex-col gap-4">
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl md:text-4xl">
              Engineered for Modern Development
            </h2>
            <p className="max-w-[700px] text-base text-[var(--muted)] sm:text-lg">
              Supercharge your workflow with context-aware AI integrated
              directly into your browser.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <FeatureCard
              icon={<Globe className="h-7 w-7" />}
              title="Full-Page Awareness"
              description="Deep understanding of DOM structures, network traffic logs, and browser console errors in real-time."
              tags={["DOM", "Network", "Errors"]}
              accentColor="primary"
            />
            <FeatureCard
              icon={<Cloud className="h-7 w-7" />}
              title="DevOps Specialist"
              description="Expert assistance for AWS, Kubernetes, and CI/CD pipelines directly inside your cloud management dashboard."
              tags={["AWS", "K8s", "CI/CD"]}
              accentColor="orange"
            />
            <FeatureCard
              icon={<FileEdit className="h-7 w-7" />}
              title="Writing Assistant"
              description="Seamlessly draft technical emails, documentation, and chat responses while maintaining your project's context."
              tags={["Emails", "Docs", "Chats"]}
              accentColor="purple"
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <CTASection
        title="Ready to transform your browser?"
        subtitle="Join developers using DevMentorAI today. Free and open source — no credit card required."
        primaryLabel="Install Extension (Free)"
        primaryHref="/installation"
        secondaryLabel="View on GitHub"
        secondaryHref="https://github.com/BOTOOM/devmentorai"
      />
    </>
  );
}
