import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy, ArrowRight, Github } from "lucide-react";
import { HeroSection } from "@/components/sections/HeroSection";
import { CTASection } from "@/components/sections/CTASection";
import { Badge } from "@/components/ui/Badge";

const ISSUES_URL = "https://github.com/BOTOOM/devmentorai/issues";

export const metadata: Metadata = {
  title: "Support",
  description:
    "Get support, report bugs, and request features through the official DevMentorAI GitHub Issues board.",
};

export default function SupportPage() {
  return (
    <>
      <HeroSection
        badge={<Badge icon={<LifeBuoy className="h-3 w-3" />}>Support</Badge>}
        title={
          <>
            Need help or a new <span className="text-primary">feature?</span>
          </>
        }
        subtitle="DevMentorAI support is managed through GitHub Issues. Open it when you are ready to report bugs or request improvements."
      />

      <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6 md:pb-24">
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 shadow-lg sm:p-8">
          <h2 className="mb-3 text-xl font-bold sm:text-2xl">Where to ask for help</h2>
          <p className="mb-5 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
            If you need technical help or want to propose a new feature, open an issue in the repository. Include context, screenshots, and reproduction steps when possible.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={ISSUES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
            >
              <Github className="h-4 w-4" />
              Open GitHub Issues
              <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              href="/faq"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--section-alt)] px-4 py-2.5 text-sm font-semibold text-[var(--muted)] transition-colors hover:text-primary"
            >
              Read FAQ first
            </Link>
          </div>
        </div>
      </section>

      <CTASection
        title="Join the roadmap conversation"
        subtitle="Your feedback directly shapes upcoming DevMentorAI releases."
        primaryLabel="Go to Issues"
        primaryHref={ISSUES_URL}
        secondaryLabel="Back to Home"
        secondaryHref="/"
      />
    </>
  );
}
