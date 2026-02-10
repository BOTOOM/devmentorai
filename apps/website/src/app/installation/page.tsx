import type { Metadata } from "next";
import { HeroSection } from "@/components/sections/HeroSection";
import { StepCard } from "@/components/ui/StepCard";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { DownloadButtons } from "@/components/ui/DownloadButtons";
import {
  getLatestExtensionRelease,
  getFallbackRelease,
} from "@/lib/github-releases";

export const metadata: Metadata = {
  title: "Installation",
  description:
    "Get started with DevMentorAI in 2 minutes. Install the backend server and browser extension for Chrome or Firefox.",
};

export default async function InstallationPage() {
  const release =
    (await getLatestExtensionRelease()) ?? getFallbackRelease();

  return (
    <>
      <HeroSection
        title={
          <>
            Get started in{" "}
            <span className="text-primary">2 minutes.</span>
          </>
        }
        subtitle="Follow these three simple steps to set up your AI-powered developer mentoring environment."
      />

      <section className="mx-auto max-w-[800px] px-6 pb-24">
        <div className="space-y-12">
          {/* Step 1: Install Backend */}
          <StepCard
            step={1}
            title="Install the Backend"
            description="This starts the local server that connects to your GitHub Copilot CLI."
          >
            <CodeBlock code="npx devmentorai-server" language="bash" />
            <p className="mt-4 text-sm text-[var(--muted)]">
              Requires{" "}
              <a
                href="https://nodejs.org"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                Node.js 20+
              </a>{" "}
              and{" "}
              <a
                href="https://docs.github.com/en/copilot/managing-copilot/configure-personal-settings/installing-github-copilot-in-the-cli"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                GitHub Copilot CLI
              </a>{" "}
              authenticated. Available on{" "}
              <a
                href="https://www.npmjs.com/package/devmentorai-server"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                npm
              </a>.
            </p>
          </StepCard>

          {/* Step 2: Download Extension */}
          <StepCard
            step={2}
            title="Add the Browser Extension"
            description="Download the DevMentorAI extension for your browser."
          >
            <DownloadButtons release={release} />
            <p className="mt-4 text-sm text-[var(--muted)]">
              For Chrome: unzip and load via{" "}
              <code className="rounded bg-[var(--section-alt)] px-1.5 py-0.5 font-mono text-xs">
                chrome://extensions
              </code>{" "}
              → Enable Developer mode → Load unpacked.
            </p>
          </StepCard>

          {/* Step 3: Connect & Chat */}
          <StepCard
            step={3}
            title="Connect & Chat"
            description="Click the DevMentorAI icon in your toolbar to start your mentoring session."
            isLast
          >
            <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-8">
              <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent" />
              {/* Toolbar mockup */}
              <div className="relative z-10 mb-4 flex w-full max-w-sm items-center justify-between rounded-lg border border-[var(--card-border)] bg-[var(--code-bg)] p-2 shadow-2xl">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-48 rounded-full bg-slate-700" />
                </div>
                <div className="flex gap-2">
                  <div className="h-6 w-6 rounded-full bg-slate-700" />
                  <div className="flex h-6 w-6 animate-pulse items-center justify-center rounded-full bg-primary shadow-[0_0_15px_rgba(62,132,244,0.6)]">
                    <span className="text-[10px] font-bold text-white">D</span>
                  </div>
                  <div className="h-6 w-6 rounded-full bg-slate-700" />
                </div>
              </div>
              <div className="relative z-10 flex flex-col items-center gap-2">
                <p className="text-sm font-bold text-primary">
                  Waiting for connection...
                </p>
                <div className="flex gap-1">
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
                </div>
              </div>
            </div>
          </StepCard>
        </div>

        {/* Help footer */}
        <div className="mt-24 border-t border-[var(--card-border)] pt-12 text-center">
          <p className="text-sm text-[var(--muted)]">
            Need help?{" "}
            <a
              href="https://github.com/BOTOOM/devmentorai/blob/master/README.md"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              Read the full documentation
            </a>{" "}
            or{" "}
            <a
              href="https://github.com/BOTOOM/devmentorai/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              open an issue on GitHub
            </a>.
          </p>
        </div>
      </section>
    </>
  );
}
