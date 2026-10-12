type GameBrandProps = {
  size?: "splash" | "page";
  className?: string;
};

/**
 * Original ball mark: a ring with the classic seam lines. Not a league or
 * team logo; decorative only (the wordmark beside it carries the name).
 */
function BallMark(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className={props.className}
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="20" />
      <path d="M4 24h40M24 4v40" />
      <path d="M9.5 9.5c7 6 7 22 0 29M38.5 9.5c-7 6-7 22 0 29" />
    </svg>
  );
}

export function GameBrand(props: GameBrandProps) {
  const size = props.size ?? "page";
  const splash = size === "splash";

  return (
    <div
      className={[
        "flex items-center gap-4",
        splash ? "flex-col sm:gap-5" : "",
        props.className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <BallMark
        className={
          splash
            ? "h-16 w-16 text-team-ink sm:h-20 sm:w-20"
            : "h-10 w-10 shrink-0 text-team-ink sm:h-12 sm:w-12"
        }
      />
      <div className={splash ? "text-center" : ""}>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-team-ink">
          Basketball
        </p>
        <h1
          className={`mt-1 font-display font-extrabold uppercase leading-none tracking-wide text-zinc-50 ${
            splash ? "text-6xl sm:text-8xl" : "text-4xl sm:text-5xl"
          }`}
        >
          BallSim
        </h1>
        <p
          className={`mt-2 font-display font-semibold uppercase tracking-[0.25em] text-zinc-300 ${
            splash ? "text-lg sm:text-xl" : "text-sm sm:text-base"
          }`}
        >
          Franchise Simulation
        </p>
      </div>
    </div>
  );
}
