import { buttonClass } from "@/components/ui/Button";
import Link from "next/link";
import type {
  GameModeCatalogId,
  GameModeDefinition,
} from "@/application/game-mode-catalog";
import { ArenaPanel } from "@/components/ui/ArenaPanel";
import { cn, focusRingClass } from "@/components/ui/styles";

/**
 * Mode icons share one style: 24 grid, 1.75 stroke, currentColor, round caps.
 * Original line art; decorative (the card text carries the meaning).
 */
function ModeIcon(props: { id: GameModeCatalogId; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={props.className}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {props.id === "owner" ? (
        <>
          {/* Arena: roofline, doorway and a flag pole. */}
          <path d="M3 21h18" />
          <path d="M5 21V10l7-5 7 5v11" />
          <path d="M9 21v-6h6v6" />
          <path d="M12 5V2" />
        </>
      ) : props.id === "career" ? (
        <>
          {/* Career: stairs climbing to a marker. */}
          <path d="M3 21h18" />
          <path d="M5 21v-4h4v-4h4V9h4V5" />
          <path d="M17 5h3" />
        </>
      ) : (
        <>
          {/* Dynasty: crown. */}
          <path d="M4 19h16" />
          <path d="M4 19 3 8l5 4 4-7 4 7 5-4-1 11" />
        </>
      )}
    </svg>
  );
}

/**
 * Mode picker card. Owner Mode is the hero (whole card links, three feature
 * lines, one primary action). Career and Dynasty are small dimmed tiles with a
 * single "Coming Soon" label.
 */
export function GameModeCard(props: { mode: GameModeDefinition }) {
  const { mode } = props;
  const live = mode.available && mode.entryHref != null;

  if (!live) {
    return (
      <article className="flex items-center gap-4 rounded-xl border border-surface-line bg-surface-deep p-4 text-muted">
        <ModeIcon id={mode.id} className="h-8 w-8 shrink-0 text-faint" />
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold uppercase leading-tight tracking-wide text-muted">
            {mode.name}
          </h2>
          <p className="text-sm text-muted">{mode.statusLabel}</p>
        </div>
      </article>
    );
  }

  const label = `${mode.name}. ${mode.tagline} ${mode.actionLabel}`;

  return (
    <ArenaPanel
      as="article"
      hero
      glow
      edge="top"
      className="hover-lift relative flex flex-col gap-6 md:flex-row md:items-center md:gap-10"
    >
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-team/20 text-team-ink md:h-32 md:w-32">
        <ModeIcon id={mode.id} className="h-12 w-12 md:h-20 md:w-20" />
      </div>

      <div className="flex-1 space-y-3">
        <div className="space-y-1">
          <h2 className="font-display text-4xl font-extrabold uppercase leading-none tracking-wide text-ink md:text-5xl">
            {mode.name}
          </h2>
          <p className="text-base font-medium text-team-ink">{mode.tagline}</p>
        </div>
        <ul className="space-y-1 text-sm text-soft">
          {mode.features.slice(0, 3).map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </div>

      <Link
        href={mode.entryHref!}
        aria-label={label}
        className={cn(
          buttonClass({ variant: "primary", size: "lg" }),
          "after:absolute after:inset-0 after:content-[''] md:px-10",
          focusRingClass,
        )}
      >
        {mode.actionLabel} →
      </Link>
    </ArenaPanel>
  );
}
