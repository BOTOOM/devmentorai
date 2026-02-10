"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CodeBlock({
  code,
  language = "bash",
}: Readonly<{ code: string; language?: string }>) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--code-bg)] shadow-lg">
      <div className="flex items-center justify-between border-b border-white/5 bg-[#161b22] px-4 py-2">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-red-500/50" />
          <div className="h-3 w-3 rounded-full bg-yellow-500/50" />
          <div className="h-3 w-3 rounded-full bg-green-500/50" />
        </div>
        <span className="font-mono text-xs text-slate-500">{language}</span>
      </div>
      <div className="flex items-center justify-between p-6">
        <code className="font-mono text-lg text-primary md:text-xl">
          <span className="mr-2 text-slate-500">$</span>
          {code}
        </code>
        <button
          onClick={handleCopy}
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-primary/20 bg-primary-light px-3 py-1.5 text-xs font-bold text-primary transition-all hover:bg-primary/20"
          aria-label="Copy command"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              COPIED
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              COPY
            </>
          )}
        </button>
      </div>
    </div>
  );
}
