import type { ReactNode } from "react";

interface StepCardProps {
  readonly step: number;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
  readonly isLast?: boolean;
}

export function StepCard({
  step,
  title,
  description,
  children,
  isLast = false,
}: StepCardProps) {
  return (
    <div className="group relative flex gap-3 sm:gap-6">
      <div className="relative flex flex-col items-center">
        <div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white sm:h-10 sm:w-10 sm:text-sm">
          {step}
        </div>
        {!isLast && (
          <div className="absolute top-8 h-full w-px bg-[var(--card-border)] sm:top-10" />
        )}
      </div>
      <div className={`flex-1 ${isLast ? "" : "pb-12"}`}>
        <div className="mb-6 flex flex-col gap-1">
          <h3 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h3>
          <p className="text-sm text-[var(--muted)] sm:text-base">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
