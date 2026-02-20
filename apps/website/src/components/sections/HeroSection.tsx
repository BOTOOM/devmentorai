import type { ReactNode } from "react";

interface HeroSectionProps {
  readonly badge?: ReactNode;
  readonly title: ReactNode;
  readonly subtitle: string;
  readonly actions?: ReactNode;
  readonly children?: ReactNode;
}

export function HeroSection({
  badge,
  title,
  subtitle,
  actions,
  children,
}: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden px-4 py-14 sm:px-6 md:px-12 md:py-20 lg:px-20 lg:py-24">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-7 text-center md:gap-8">
        {badge}
        <h1 className="max-w-[900px] text-3xl font-black leading-[1.1] tracking-tight sm:text-4xl md:text-6xl lg:text-7xl">
          {title}
        </h1>
        <p className="max-w-[700px] text-base font-normal leading-relaxed text-[var(--muted)] sm:text-lg md:text-xl">
          {subtitle}
        </p>
        {actions && (
          <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            {actions}
          </div>
        )}
        {children}
      </div>
      {/* Background decoration */}
      <div className="pointer-events-none absolute -bottom-20 -left-20 -z-10 h-64 w-64 rounded-full bg-primary-glow blur-[100px]" />
    </section>
  );
}
