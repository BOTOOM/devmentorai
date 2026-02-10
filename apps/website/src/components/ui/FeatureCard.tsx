import type { ReactNode } from "react";

interface FeatureCardProps {
  readonly icon: ReactNode;
  readonly title: string;
  readonly description: string;
  readonly tags?: readonly string[];
  readonly accentColor?: string;
}

export function FeatureCard({
  icon,
  title,
  description,
  tags,
  accentColor = "primary",
}: FeatureCardProps) {
  const hoverBorderMap: Record<string, string> = {
    orange: "hover:border-orange-500/50",
    purple: "hover:border-purple-500/50",
    emerald: "hover:border-emerald-500/50",
    red: "hover:border-red-500/50",
    primary: "hover:border-primary/50",
  };
  const hoverBorderClass = hoverBorderMap[accentColor] ?? "hover:border-primary/50";

  return (
    <div
      className={`group/card flex flex-col gap-5 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-8 transition-all ${hoverBorderClass}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-light text-primary transition-transform group-hover/card:scale-110">
        {icon}
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-xl font-bold">{title}</h3>
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          {description}
        </p>
      </div>
      {tags && tags.length > 0 && (
        <div className="mt-auto flex gap-2 pt-4">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-[var(--section-alt)] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
