"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === "system") setTheme("light");
    else if (theme === "light") setTheme("dark");
    else setTheme("system");
  };

  return (
    <button
      onClick={cycleTheme}
      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--card)] transition-colors hover:border-primary/50"
      aria-label={`Current theme: ${theme ?? "system"}. Click to change.`}
    >
      {theme === "light" && <Sun className="h-4 w-4 text-amber-500" />}
      {theme === "dark" && <Moon className="h-4 w-4 text-primary" />}
      {(theme === "system" || !theme) && <Monitor className="h-4 w-4 text-[var(--muted)]" />}
    </button>
  );
}
