'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const cycleTheme = () => {
    if (!mounted) return;
    if (theme === 'system') setTheme('light');
    else if (theme === 'light') setTheme('dark');
    else setTheme('system');
  };

  return (
    <button
      onClick={cycleTheme}
      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--card)] transition-colors hover:border-primary/50"
      aria-label={
        mounted ? `Current theme: ${theme ?? 'system'}. Click to change.` : 'Change theme'
      }
    >
      {(!mounted || theme === 'system' || !theme) && (
        <Monitor className="h-4 w-4 text-[var(--muted)]" />
      )}
      {mounted && theme === 'light' && <Sun className="h-4 w-4 text-amber-500" />}
      {mounted && theme === 'dark' && <Moon className="h-4 w-4 text-primary" />}
    </button>
  );
}
