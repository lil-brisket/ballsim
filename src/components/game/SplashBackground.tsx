/**
 * CSS/HTML court atmosphere for splash and landing.
 * No external image assets.
 */
export function SplashBackground(props: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${props.className ?? ""}`}
      aria-hidden
    >
      <div className="splash-court absolute inset-0" />
      <div className="splash-vignette absolute inset-0" />
      <svg
        className="splash-court-lines absolute inset-0 h-full w-full opacity-[0.12]"
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Outer boundary */}
        <rect
          x="80"
          y="40"
          width="640"
          height="520"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-zinc-300"
        />
        {/* Half-court line */}
        <line
          x1="400"
          y1="40"
          x2="400"
          y2="560"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-zinc-400"
        />
        {/* Center circle */}
        <circle
          cx="400"
          cy="300"
          r="60"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-zinc-400"
        />
        {/* Left key */}
        <rect
          x="80"
          y="190"
          width="120"
          height="220"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-zinc-400"
        />
        <circle
          cx="200"
          cy="300"
          r="50"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-zinc-400"
        />
        {/* Right key */}
        <rect
          x="600"
          y="190"
          width="120"
          height="220"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-zinc-400"
        />
        <circle
          cx="600"
          cy="300"
          r="50"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-zinc-400"
        />
        {/* Three-point arcs (simplified) */}
        <path
          d="M 80 120 Q 280 300 80 480"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          className="text-zinc-500"
        />
        <path
          d="M 720 120 Q 520 300 720 480"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          className="text-zinc-500"
        />
      </svg>
    </div>
  );
}
