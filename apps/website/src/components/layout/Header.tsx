"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Github, Heart } from "lucide-react";
import { DevMentorLogo } from "@/components/ui/DevMentorLogo";
import { ThemeToggle } from "./ThemeToggle";

const NAV_LINKS = [
  { href: "/features", label: "Features" },
  { href: "/use-cases", label: "Use Cases" },
  { href: "/installation", label: "Installation" },
  { href: "/trust", label: "Trust" },
  { href: "/faq", label: "FAQ" },
  { href: "/support", label: "Support" },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--card-border)] bg-[var(--background)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <DevMentorLogo className="h-8 w-8" />
          <span className="text-lg font-bold tracking-tight sm:text-xl">DevMentorAI</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-6 lg:flex">
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
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a
            href="https://github.com/BOTOOM/devmentorai"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden h-10 w-10 items-center justify-center rounded-lg border border-[var(--card-border)] text-[var(--muted)] transition-colors hover:text-primary lg:flex"
            aria-label="GitHub repository"
          >
            <Github className="h-4.5 w-4.5" />
          </a>
          <a
            href="https://github.com/sponsors/BOTOOM"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden h-10 w-10 items-center justify-center rounded-lg border border-[var(--card-border)] text-[var(--muted)] transition-colors hover:text-pink-500 lg:flex"
            aria-label="Sponsor DevMentorAI"
          >
            <Heart className="h-4.5 w-4.5" />
          </a>
          <Link
            href="/installation"
            className="hidden items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/20 md:flex"
          >
            Get Started
          </Link>
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-[var(--card-border)] md:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <nav className="border-t border-[var(--card-border)] bg-[var(--background)] px-6 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-2 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--section-alt)] hover:text-primary"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-1 flex items-center gap-2">
              <a
                href="https://github.com/BOTOOM/devmentorai"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 flex-1 items-center justify-center rounded-lg border border-[var(--card-border)] text-sm font-medium text-[var(--muted)]"
                aria-label="GitHub repository"
              >
                <Github className="mr-2 h-4 w-4" />
                GitHub
              </a>
              <a
                href="https://github.com/sponsors/BOTOOM"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 flex-1 items-center justify-center rounded-lg border border-[var(--card-border)] text-sm font-medium text-[var(--muted)]"
                aria-label="Sponsor DevMentorAI"
              >
                <Heart className="mr-2 h-4 w-4" />
                Sponsor
              </a>
            </div>
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
