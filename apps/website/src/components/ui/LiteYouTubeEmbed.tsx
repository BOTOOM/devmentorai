"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";

interface LiteYouTubeEmbedProps {
  readonly videoId: string;
  readonly title: string;
  readonly className?: string;
}

let preconnectDone = false;

function warmUpConnections() {
  if (preconnectDone || typeof document === "undefined") return;

  const urls = [
    "https://www.youtube-nocookie.com",
    "https://www.google.com",
    "https://i.ytimg.com",
  ];

  urls.forEach((href) => {
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = href;
    if (href.includes("google.com")) {
      link.crossOrigin = "anonymous";
    }
    document.head.appendChild(link);
  });

  preconnectDone = true;
}

export function LiteYouTubeEmbed({
  videoId,
  title,
  className,
}: Readonly<LiteYouTubeEmbedProps>) {
  const [isActivated, setIsActivated] = useState(false);
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const posterUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  const handleActivate = useCallback(() => {
    warmUpConnections();
    setIsActivated(true);
  }, []);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card)] shadow-xl ${className ?? ""}`}
      onPointerOver={warmUpConnections}
    >
      <div className="aspect-video">
        {isActivated ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
            title={title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={handleActivate}
            className="group relative h-full w-full cursor-pointer"
            aria-label={`Play video: ${title}`}
          >
            <Image
              src={posterUrl}
              alt={`Video preview: ${title}`}
              fill
              sizes="(max-width: 768px) 100vw, 960px"
              priority={false}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/90 text-white shadow-lg transition-transform duration-200 group-hover:scale-105">
                <Play className="h-7 w-7" fill="currentColor" />
              </span>
            </div>
            <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-slate-950/75 px-3 py-2 text-left text-xs font-medium text-slate-100 backdrop-blur-sm sm:text-sm">
              {title}
            </div>
          </button>
        )}
      </div>

      {!isActivated && (
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-3 top-3 rounded bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-black"
        >
          Watch on YouTube
        </a>
      )}
    </div>
  );
}
