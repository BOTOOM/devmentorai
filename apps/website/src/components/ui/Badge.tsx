import type { ReactNode } from "react";

export function Badge({
  children,
  icon,
}: Readonly<{ children: ReactNode; icon?: ReactNode }>) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-light px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
      {icon}
      {children}
    </div>
  );
}

export function PulseBadge({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <Badge
      icon={
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
      }
    >
      {children}
    </Badge>
  );
}
