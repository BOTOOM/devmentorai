"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { DevMentorLogo } from "@/components/ui/DevMentorLogo";
import { ThemeToggle } from "./ThemeToggle";

const NAV_LINKS = [
  { href: "/features", label: "Features" },
  { href: "/use-cases", label: "Use Cases" },
  { href: "/installation", label: "Installation" },
  { href: "/trust", label: "Trust" },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--card-border)] bg-[var(--background)]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <DevMentorLogo className="h-8 w-8" />
          <span className="text-xl font-bold tracking-tight">DevMentorAI</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-[var(--muted)] transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/installation"
            className="hidden items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/20 md:flex"
          >
            Get Started
          </Link>
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[var(--card-border)] md:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <nav className="border-t border-[var(--card-border)] bg-[var(--background)] px-6 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-sm font-medium text-[var(--muted)] transition-colors hover:text-primary"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/installation"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-primary-hover"
            >
              Get Started
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
