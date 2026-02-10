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
    <div className="group relative flex gap-6">
      <div className="relative flex flex-col items-center">
        <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
          {step}
        </div>
        {!isLast && (
          <div className="absolute top-10 h-full w-px bg-[var(--card-border)]" />
        )}
      </div>
      <div className={`flex-1 ${isLast ? "" : "pb-12"}`}>
        <div className="mb-6 flex flex-col gap-1">
          <h3 className="text-2xl font-bold tracking-tight">{title}</h3>
          <p className="text-base text-[var(--muted)]">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
