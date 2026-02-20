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
    <section className="border-t border-[var(--card-border)] bg-primary-light px-4 py-16 sm:px-6 md:px-12 md:py-20 lg:px-20 lg:py-24">
      <div className="mx-auto flex max-w-[800px] flex-col items-center gap-8 text-center">
        <h2 className="text-3xl font-black leading-tight tracking-tight sm:text-4xl md:text-5xl">
          {title}
        </h2>
        <p className="text-base text-[var(--muted)] sm:text-lg">{subtitle}</p>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:gap-4">
          <Link
            href={primaryHref}
            className="flex w-full cursor-pointer items-center justify-center rounded-lg bg-primary px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-primary/20 transition-transform hover:scale-[1.02] sm:min-w-[220px] sm:px-8 sm:py-4 sm:text-lg"
          >
            {primaryLabel}
          </Link>
          {secondaryLabel && secondaryHref && (
            <Link
              href={secondaryHref}
              className="flex w-full cursor-pointer items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-6 py-3.5 text-base font-bold transition-colors hover:border-primary/50 sm:min-w-[220px] sm:px-8 sm:py-4 sm:text-lg"
            >
              {secondaryLabel}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
