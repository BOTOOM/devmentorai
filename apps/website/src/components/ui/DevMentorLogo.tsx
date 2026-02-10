export function DevMentorLogo({ className = "h-8 w-8" }: Readonly<{ className?: string }>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      className={className}
    >
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#3b82f6" }} />
          <stop offset="100%" style={{ stopColor: "#6366f1" }} />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="24" fill="url(#bg)" />
      <text
        x="64"
        y="82"
        fontFamily="system-ui"
        fontSize="60"
        fontWeight="bold"
        fill="white"
        textAnchor="middle"
      >
        D
      </text>
      <circle cx="98" cy="30" r="18" fill="#22c55e" />
      <path
        d="M90 30 L96 36 L108 24"
        stroke="white"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
