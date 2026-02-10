import Link from "next/link";

interface CTASectionProps {
  readonly title: string;
  readonly subtitle: string;
  readonly primaryLabel?: string;
  readonly primaryHref?: string;
  readonly secondaryLabel?: string;
  readonly secondaryHref?: string;
}

export function CTASection({
  title,
  subtitle,
  primaryLabel = "Get Started",
  primaryHref = "/installation",
  secondaryLabel,
  secondaryHref,
}: CTASectionProps) {
  return (
    <section className="border-t border-[var(--card-border)] bg-primary-light px-6 py-24 md:px-20">
      <div className="mx-auto flex max-w-[800px] flex-col items-center gap-8 text-center">
        <h2 className="text-4xl font-black leading-tight tracking-tight md:text-5xl">
          {title}
        </h2>
        <p className="text-lg text-[var(--muted)]">{subtitle}</p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href={primaryHref}
            className="flex min-w-[240px] cursor-pointer items-center justify-center rounded-lg bg-primary px-8 py-4 text-lg font-bold text-white shadow-lg shadow-primary/20 transition-transform hover:scale-[1.02]"
          >
            {primaryLabel}
          </Link>
          {secondaryLabel && secondaryHref && (
            <Link
              href={secondaryHref}
              className="flex min-w-[240px] cursor-pointer items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-8 py-4 text-lg font-bold transition-colors hover:border-primary/50"
            >
              {secondaryLabel}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
