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
    <section className="relative overflow-hidden px-6 py-16 md:px-20 md:py-24">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-8 text-center">
        {badge}
        <h1 className="max-w-[900px] text-4xl font-black leading-[1.1] tracking-tight md:text-7xl">
          {title}
        </h1>
        <p className="max-w-[700px] text-lg font-normal leading-relaxed text-[var(--muted)] md:text-xl">
          {subtitle}
        </p>
        {actions && (
          <div className="flex flex-wrap items-center justify-center gap-4">
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
