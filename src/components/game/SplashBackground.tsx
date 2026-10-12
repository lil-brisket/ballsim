/**
 * CSS/HTML court atmosphere for splash and landing.
 * No external image assets.
 */
export function SplashBackground(props: {
  className?: string;
  /** Stronger court lines for the splash; other pages keep them subtle. */
  prominent?: boolean;
}) {
  return (
    <div
      className={`court-line-animate pointer-events-none absolute inset-0 overflow-hidden ${props.className ?? ""}`}
      aria-hidden
      suppressHydrationWarning
    >
      <div className="splash-court absolute inset-0" />
      <div className="splash-glow absolute inset-0" />
      <div className="splash-vignette absolute inset-0" />
      <svg
        className={`splash-court-lines absolute inset-0 h-full w-full ${props.prominent ? "opacity-[0.2]" : "opacity-[0.09]"}`}
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid slice"
        suppressHydrationWarning
      >
        {/* Outer boundary */}
        <rect
          pathLength="1"
          style={{ "--i": 0 } as React.CSSProperties}
          x="80"
          y="40"
          width="640"
          height="520"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="court-line text-zinc-300"
          suppressHydrationWarning
        />
        {/* Half-court line */}
        <line
          pathLength="1"
          style={{ "--i": 1 } as React.CSSProperties}
          x1="400"
          y1="40"
          x2="400"
          y2="560"
          stroke="currentColor"
          strokeWidth="1.5"
          className="court-line text-zinc-400"
          suppressHydrationWarning
        />
        {/* Center circle */}
        <circle
          pathLength="1"
          style={{ "--i": 2 } as React.CSSProperties}
          cx="400"
          cy="300"
          r="60"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="court-line text-zinc-400"
          suppressHydrationWarning
        />
        {/* Left key */}
        <rect
          pathLength="1"
          style={{ "--i": 3 } as React.CSSProperties}
          x="80"
          y="190"
          width="120"
          height="220"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="court-line text-zinc-400"
          suppressHydrationWarning
        />
        <circle
          pathLength="1"
          style={{ "--i": 4 } as React.CSSProperties}
          cx="200"
          cy="300"
          r="50"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="court-line text-zinc-400"
          suppressHydrationWarning
        />
        {/* Right key */}
        <rect
          pathLength="1"
          style={{ "--i": 5 } as React.CSSProperties}
          x="600"
          y="190"
          width="120"
          height="220"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="court-line text-zinc-400"
          suppressHydrationWarning
        />
        <circle
          pathLength="1"
          style={{ "--i": 6 } as React.CSSProperties}
          cx="600"
          cy="300"
          r="50"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="court-line text-zinc-400"
          suppressHydrationWarning
        />
        {/* Three-point arcs (simplified) */}
        <path
          pathLength="1"
          style={{ "--i": 7 } as React.CSSProperties}
          d="M 80 120 Q 280 300 80 480"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          className="court-line text-zinc-500"
          suppressHydrationWarning
        />
        <path
          pathLength="1"
          style={{ "--i": 8 } as React.CSSProperties}
          d="M 720 120 Q 520 300 720 480"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          className="court-line text-zinc-500"
          suppressHydrationWarning
        />
      </svg>
    </div>
  );
}
