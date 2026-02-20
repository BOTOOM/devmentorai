import Link from "next/link";
import { Heart, Coffee, CodeXml } from "lucide-react";
import { DevMentorLogo } from "@/components/ui/DevMentorLogo";

export function Footer() {
  return (
    <footer className="border-t border-[var(--card-border)] bg-[var(--background)]">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-col gap-12">
          {/* Top row */}
          <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
            <div className="flex items-center gap-3">
              <DevMentorLogo className="h-6 w-6" />
              <span className="text-lg font-bold">DevMentorAI</span>
            </div>

            <nav className="flex flex-wrap items-center justify-center gap-8">
              <Link
                href="/features"
                className="text-sm font-medium text-[var(--muted)] transition-colors hover:text-primary"
              >
                Features
              </Link>
              <Link
                href="/use-cases"
                className="text-sm font-medium text-[var(--muted)] transition-colors hover:text-primary"
              >
                Use Cases
              </Link>
              <Link
                href="/installation"
                className="text-sm font-medium text-[var(--muted)] transition-colors hover:text-primary"
              >
                Installation
              </Link>
              <Link
                href="/trust"
                className="text-sm font-medium text-[var(--muted)] transition-colors hover:text-primary"
              >
                Trust & Privacy
              </Link>
              <Link
                href="/faq"
                className="text-sm font-medium text-[var(--muted)] transition-colors hover:text-primary"
              >
                FAQ
              </Link>
              <Link
                href="/support"
                className="text-sm font-medium text-[var(--muted)] transition-colors hover:text-primary"
              >
                Support
              </Link>
            </nav>

            <div className="flex items-center gap-4">
              <a
                href="https://github.com/BOTOOM/devmentorai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--muted)] transition-colors hover:text-primary"
                aria-label="GitHub repository"
              >
                <CodeXml className="h-5 w-5" />
              </a>
              <a
                href="https://github.com/sponsors/BOTOOM"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--muted)] transition-colors hover:text-pink-500"
                aria-label="Sponsor on GitHub"
              >
                <Heart className="h-5 w-5" />
              </a>
              <a
                href="https://buymeacoffee.com/edwardiazdev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--muted)] transition-colors hover:text-amber-500"
                aria-label="Buy me a coffee"
              >
                <Coffee className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Bottom row */}
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-[var(--muted)]">
              &copy; {new Date().getFullYear()} DevMentorAI. All rights
              reserved. Built for developers, by developers.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
