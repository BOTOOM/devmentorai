import type { Metadata } from "next";
import { CloudCog, FileText, MonitorDot, ShieldAlert } from "lucide-react";
import { HeroSection } from "@/components/sections/HeroSection";
import { CTASection } from "@/components/sections/CTASection";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "Use Cases",
  description:
    "Discover how DevMentorAI helps with cloud troubleshooting, technical writing, frontend debugging, and security audits.",
};

const USE_CASES = [
  {
    icon: <CloudCog className="h-8 w-8" />,
    title: "Cloud Troubleshooting",
    description:
      "Quickly identify and resolve infrastructure bottlenecks. Debug complex AWS IAM policy errors directly in the console with AI-driven precision and security context.",
    color: "orange" as const,
    gradient: "from-orange-500",
  },
  {
    icon: <FileText className="h-8 w-8" />,
    title: "Technical Writing",
    description:
      "Transform chaotic data into structured narratives. Automatically draft complex post-mortems and incident reports from browser logs and system metrics effortlessly.",
    color: "purple" as const,
    gradient: "from-purple-500",
  },
  {
    icon: <MonitorDot className="h-8 w-8" />,
    title: "Frontend Debugging",
    description:
      "See through the complexity of the DOM. Instantly understand why a React component isn't rendering or identify race conditions in state management in real-time.",
    color: "emerald" as const,
    gradient: "from-emerald-500",
  },
  {
    icon: <ShieldAlert className="h-8 w-8" />,
    title: "Security Audit",
    description:
      "Secure your applications by understanding the risks. Get explanations of OWASP vulnerabilities found in web tools and receive remediation guidance in plain English.",
    color: "red" as const,
    gradient: "from-red-500",
  },
] as const;

const colorMap: Record<string, string> = {
  orange: "bg-orange-500/10 text-orange-500 hover:border-orange-500/50",
  purple: "bg-purple-500/10 text-purple-500 hover:border-purple-500/50",
  emerald: "bg-emerald-500/10 text-emerald-500 hover:border-emerald-500/50",
  red: "bg-red-500/10 text-red-500 hover:border-red-500/50",
};

const iconBgMap: Record<string, string> = {
  orange: "bg-orange-500/10 text-orange-500",
  purple: "bg-purple-500/10 text-purple-500",
  emerald: "bg-emerald-500/10 text-emerald-500",
  red: "bg-red-500/10 text-red-500",
};

export default function UseCasesPage() {
  return (
    <>
      <HeroSection
        badge={<Badge>Explore Capabilities</Badge>}
        title={
          <>
            Solve problems faster{" "}
            <span className="text-primary">with context.</span>
          </>
        }
        subtitle="DevMentorAI bridges the gap between your browser data and expert solutions across every DevOps and Engineering workflow."
      />

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
          {USE_CASES.map((useCase) => {
            const classes = colorMap[useCase.color] ?? "";
            const iconClasses = iconBgMap[useCase.color] ?? "";
            return (
              <div
                key={useCase.title}
                className={`group relative flex cursor-pointer flex-col rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-8 transition-all duration-300 ${classes.split(" ").pop()}`}
              >
                {/* Top accent line */}
                <div
                  className={`absolute left-0 top-0 h-1 w-full rounded-t-xl bg-gradient-to-r ${useCase.gradient} to-transparent opacity-50`}
                />
                <div className="mb-6 flex items-center gap-4">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-lg ${iconClasses}`}
                  >
                    {useCase.icon}
                  </div>
                  <h3 className="text-xl font-bold">{useCase.title}</h3>
                </div>
                <p className="leading-relaxed text-[var(--muted)]">
                  {useCase.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <CTASection
        title="Ready to supercharge your workflow?"
        subtitle="Join developers using DevMentorAI to ship faster and debug smarter."
        primaryLabel="Get Started Now"
        primaryHref="/installation"
        secondaryLabel="View on GitHub"
        secondaryHref="https://github.com/BOTOOM/devmentorai"
      />
    </>
  );
}
