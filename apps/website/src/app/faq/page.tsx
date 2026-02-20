import type { Metadata } from "next";
import Link from "next/link";
import { HelpCircle, MessageCircleQuestion } from "lucide-react";
import { HeroSection } from "@/components/sections/HeroSection";
import { CTASection } from "@/components/sections/CTASection";
import { Badge } from "@/components/ui/Badge";

const FAQ_ITEMS = [
  {
    question: "Does DevMentorAI send my code to DevMentorAI servers?",
    answer:
      "No. DevMentorAI works locally with your browser extension and local backend. Your code and context are processed through your authenticated GitHub Copilot flow.",
  },
  {
    question: "How long does installation take?",
    answer:
      "Most users complete setup in around 2 minutes: run the backend, load the extension, and open the side panel.",
  },
  {
    question: "Which browsers are supported?",
    answer:
      "DevMentorAI supports Chromium-based browsers and Firefox builds provided in the release artifacts.",
  },
  {
    question: "Can I use DevMentorAI on private dashboards?",
    answer:
      "Yes. Context extraction is designed for real authenticated pages while keeping data local and user-controlled.",
  },
  {
    question: "Where do I report bugs or request features?",
    answer:
      "Use the GitHub Issues section. We review bug reports and feature requests there.",
  },
] as const;

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about DevMentorAI installation, privacy, browser support, and issue reporting.",
};

export default function FAQPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <HeroSection
        badge={<Badge icon={<HelpCircle className="h-3 w-3" />}>Knowledge Base</Badge>}
        title={
          <>
            Frequently asked <span className="text-primary">questions</span>
          </>
        }
        subtitle="Everything you need to know to install, run, and troubleshoot DevMentorAI quickly."
      />

      <section className="mx-auto max-w-4xl px-4 pb-20 sm:px-6 md:pb-24">
        <div className="space-y-4">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.question}
              className="group rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5 transition-colors open:border-primary/40"
            >
              <summary className="cursor-pointer list-none text-left text-base font-semibold sm:text-lg">
                <span className="inline-flex items-start gap-2">
                  <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {item.question}
                </span>
              </summary>
              <p className="mt-3 pl-6 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
                {item.answer}
              </p>
            </details>
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] p-5 sm:p-6">
          <p className="text-sm leading-relaxed text-[var(--muted)] sm:text-base">
            Didn&apos;t find your answer? Visit the {" "}
            <Link href="/support" className="font-semibold text-primary hover:underline">
              support page
            </Link>{" "}
            to open an issue or request a feature.
          </p>
        </div>
      </section>

      <CTASection
        title="Ready to try DevMentorAI?"
        subtitle="Install the extension and local backend in minutes."
        primaryLabel="Go to Installation"
        primaryHref="/installation"
        secondaryLabel="Open Support"
        secondaryHref="/support"
      />
    </>
  );
}
