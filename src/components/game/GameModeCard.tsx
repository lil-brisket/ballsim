import Link from "next/link";
import type {
  GameModeCatalogId,
  GameModeDefinition,
} from "@/application/game-mode-catalog";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn, focusRingClass } from "@/components/ui/styles";

/**
 * Illustration-style header art per mode. Original geometric shapes only;
 * decorative (the card text carries the meaning).
 */
function ModeArt(props: { id: GameModeCatalogId }) {
  return (
    <svg
      viewBox="0 0 240 96"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {props.id === "owner" ? (
        <>
          {/* Arena skyline: towers, a dome and a rising ticker line. */}
          <path d="M20 96V58h26v38M58 96V36h30v60M100 96V50h22v46M134 96V64h26v38" />
          <path d="M168 96V70a30 30 0 0 1 60 0v26" />
          <path d="M12 34l36-14 40 10 46-22 52 16" strokeWidth="3" />
          <circle cx="186" cy="24" r="4" fill="currentColor" />
        </>
      ) : props.id === "career" ? (
        <>
          {/* Career path: stairs climbing to a marker. */}
          <path d="M16 88h36V70h36V52h36V34h36V16h36" strokeWidth="3" />
          <circle cx="198" cy="12" r="5" fill="currentColor" />
          <path d="M16 96h208" />
        </>
      ) : (
        <>
          {/* Dynasty: tiers and a crown. */}
          <path d="M60 90l24-34 36 20 36-20 24 34z" />
          <path d="M84 56l-6-22M120 76l0-44M156 56l6-22" />
          <circle cx="78" cy="30" r="4" fill="currentColor" />
          <circle cx="120" cy="26" r="4" fill="currentColor" />
          <circle cx="162" cy="30" r="4" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/**
 * Mode picker card. Owner Mode is the live option (whole card links, team
 * colour accents); Career and Dynasty are visibly locked. The feature list
 * sits behind a disclosure so each card reads as art, name and one line.
 */
export function GameModeCard(props: { mode: GameModeDefinition }) {
  const { mode } = props;
  const live = mode.available && mode.entryHref != null;
  const label = `${mode.name}. ${mode.tagline} ${mode.actionLabel}`;

  return (
    <article
      className={cn(
        "relative flex flex-col overflow-hidden rounded-2xl border bg-surface-arena",
        live
          ? "hover-lift border-team-ink/60 shadow-team-glow"
          : "border-surface-line",
      )}
    >
      <div
        className={cn(
          "relative h-24 w-full",
          live
            ? "bg-gradient-to-br from-team/60 to-surface-arena text-team-ink"
            : "bg-surface-deep text-zinc-600 grayscale",
        )}
      >
        <ModeArt id={mode.id} />
        <span className="absolute right-3 top-3">
          <StatusBadge
            label={mode.statusLabel}
            tone={mode.available ? "success" : "info"}
          />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="space-y-1">
          <h2
            className={cn(
              "font-display text-3xl font-extrabold uppercase leading-none tracking-wide",
              live ? "text-zinc-50" : "text-zinc-400",
            )}
          >
            {mode.name}
          </h2>
          <p
            className={cn(
              "text-sm font-medium",
              live ? "text-team-ink" : "text-zinc-500",
            )}
          >
            {mode.tagline}
          </p>
        </div>

        <details className="group relative z-10 text-sm">
          <summary
            className={cn(
              "inline-flex min-h-11 cursor-pointer list-none items-center gap-1 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-300 hover:text-team-ink [&::-webkit-details-marker]:hidden",
              focusRingClass,
            )}
          >
            <span
              aria-hidden
              className="transition-transform group-open:rotate-90"
            >
              ▸
            </span>
            What&apos;s inside
          </summary>
          <p className="mt-1 leading-relaxed text-zinc-300">
            {mode.description}
          </p>
          <ul className="mt-2 space-y-1.5 text-zinc-300">
            {mode.features.map((feature) => (
              <li key={feature} className="flex gap-2">
                <span className="text-team-ink" aria-hidden>
                  •
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </details>

        {live ? (
          <Link
            href={mode.entryHref!}
            aria-label={label}
            className={cn(
              "mt-auto inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-team-ink bg-team px-6 py-2 font-display text-xl font-extrabold uppercase tracking-wide text-on-team transition hover:brightness-110",
              "after:absolute after:inset-0 after:content-['']",
              focusRingClass,
            )}
          >
            {mode.actionLabel} →
          </Link>
        ) : (
          <p className="mt-auto inline-flex min-h-11 items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-zinc-500">
            <LockIcon />
            {mode.actionLabel}
          </p>
        )}
      </div>
    </article>
  );
}
