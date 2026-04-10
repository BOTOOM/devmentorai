import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ExternalLink, History, Server, Puzzle } from "lucide-react";
import { HeroSection } from "@/components/sections/HeroSection";
import { CTASection } from "@/components/sections/CTASection";
import { Badge } from "@/components/ui/Badge";
import {
  formatChangelogDate,
  getChangelogEntries,
  type ChangelogTrack,
} from "@/lib/changelog-data";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "Friendly release notes for DevMentorAI extension and backend updates, focused on user-facing improvements and fixes.",
};

const TRACK_META: Record<ChangelogTrack, { title: string; subtitle: string; icon: typeof Puzzle }> = {
  extension: {
    title: "Extension releases",
    subtitle:
      "What changed in the browser extension you use every day, explained in plain language.",
    icon: Puzzle,
  },
  backend: {
    title: "Backend releases",
    subtitle:
      "What changed in the local backend that powers chats, tools, and session behavior.",
    icon: Server,
  },
};

export default function ChangelogPage() {
  const extensionEntries = getChangelogEntries("extension");
  const backendEntries = getChangelogEntries("backend");

  const changelogJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "DevMentorAI Changelog",
    description:
      "Friendly release notes for DevMentorAI extension and backend updates.",
    hasPart: [...extensionEntries, ...backendEntries].map((entry) => ({
      "@type": "CreativeWork",
      name: `${entry.track === "extension" ? "Extension" : "Backend"} v${entry.version}`,
      datePublished: entry.releasedAt,
      url: entry.releaseUrl,
      description: entry.summary,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(changelogJsonLd) }}
      />

      <HeroSection
        badge={<Badge icon={<History className="h-3 w-3" />}>Changelog</Badge>}
        title={
          <>
            Friendly release notes for <span className="text-primary">every update</span>
          </>
        }
        subtitle="See what changed in DevMentorAI without digging through technical release logs. Extension and backend versions are tracked separately because they ship on different timelines."
      />

      <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6 md:px-12 lg:px-20">
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--section-alt)] p-5 sm:p-6">
          <p className="text-sm leading-relaxed text-[var(--muted)] sm:text-base">
            This changelog focuses on user-facing features and fixes. Website-only updates, deployment tweaks,
            and documentation-only changes are intentionally left out.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-16 px-4 pb-20 sm:px-6 md:px-12 md:pb-24 lg:px-20">
        {(["extension", "backend"] as ChangelogTrack[]).map((track) => {
          const meta = TRACK_META[track];
          const entries = track === "extension" ? extensionEntries : backendEntries;
          const Icon = meta.icon;

          return (
            <div key={track} className="space-y-6">
              <div className="space-y-3">
                <Badge icon={<Icon className="h-3 w-3" />}>{meta.title}</Badge>
                <div>
                  <h2 className="text-2xl font-black tracking-tight sm:text-3xl">{meta.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm text-[var(--muted)] sm:text-base">
                    {meta.subtitle}
                  </p>
                </div>
              </div>

              <div className="grid gap-5">
                {entries.map((entry) => (
                  <article
                    key={entry.tag}
                    id={entry.tag}
                    className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm sm:p-6"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-primary-light px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-primary">
                            {track === "extension" ? "Extension" : "Backend"}
                          </span>
                          <span className="rounded-full border border-[var(--card-border)] px-2.5 py-1 text-xs font-semibold text-[var(--muted)]">
                            v{entry.version}
                          </span>
                          <span className="text-xs text-[var(--muted)]">
                            {formatChangelogDate(entry.releasedAt)}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold tracking-tight sm:text-2xl">{entry.headline}</h3>
                        <p className="max-w-3xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
                          {entry.summary}
                        </p>
                      </div>

                      <a
                        href={entry.releaseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--section-alt)] px-4 py-2.5 text-sm font-semibold text-[var(--muted)] transition-colors hover:text-primary"
                      >
                        Technical release
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>

                    <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                      <div>
                        <p className="text-sm font-semibold text-foreground">What you would notice</p>
                        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
                          {entry.highlights.map((highlight) => (
                            <li key={highlight} className="flex gap-3">
                              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                              <span>{highlight}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--section-alt)] p-4">
                        <p className="text-sm font-semibold text-foreground">Quick reference</p>
                        <div className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                          <p>
                            <span className="font-semibold text-foreground">Published:</span>{" "}
                            {formatChangelogDate(entry.releasedAt)}
                          </p>
                          <p>
                            <span className="font-semibold text-foreground">Release tag:</span>{" "}
                            <span className="font-mono text-xs sm:text-sm">{entry.tag}</span>
                          </p>
                          {entry.fixes?.length ? (
                            <div className="pt-2">
                              <p className="font-semibold text-foreground">Fixes included</p>
                              <ul className="mt-2 space-y-2">
                                {entry.fixes.map((fix) => (
                                  <li key={fix} className="flex gap-3">
                                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                                    <span>{fix}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 md:px-12 lg:px-20">
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Need the install steps too?</h2>
              <p className="mt-2 text-sm text-[var(--muted)] sm:text-base">
                If a backend release requires a local update, the installation page shows the official paths.
              </p>
            </div>
            <Link
              href="/installation"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
            >
              Go to Installation
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <CTASection
        title="Want the full story behind each release?"
        subtitle="You can still open the technical GitHub release notes any time, but this page should keep the big picture easier to scan."
        primaryLabel="View GitHub Releases"
        primaryHref="https://github.com/BOTOOM/devmentorai/releases"
        secondaryLabel="Open Support"
        secondaryHref="/support"
      />
    </>
  );
}
