import type {
  GameModeCatalogId,
  GameModeDefinition,
} from "@/application/game-mode-catalog";
import { HubTile } from "@/components/ui/HubTile";
import { clipCornerClass } from "@/components/ui/styles";
import { SectionHeading } from "@/components/ui/SectionHeading";

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

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/**
 * Mode picker tile. Owner Mode is the hero HubTile (the whole tile is the
 * entry link). Modes that are not available render as locked, non-interactive
 * tiles: a plain article (not focusable, not a link) that announces
 * "Coming soon".
 */
export function GameModeCard(props: {
  mode: GameModeDefinition;
  index?: number;
}) {
  const { mode } = props;
  const live = mode.available && mode.entryHref != null;

  if (!live) {
    return (
      <article
        aria-label={`${mode.name}, coming soon`}
        className="enter-up tile-enter relative min-h-36 text-muted"
        style={{ "--i": props.index ?? 1 } as React.CSSProperties}
      >
        <span
          aria-hidden
          className={`${clipCornerClass} absolute inset-0 bg-surface-line`}
        />
        <span
          aria-hidden
          className={`${clipCornerClass} absolute inset-[2px] bg-surface-deep`}
        />
        <div className="relative flex h-full min-h-[inherit] flex-col justify-between gap-4 p-4">
          <div className="flex items-start gap-3 pr-6">
            <ModeIcon id={mode.id} className="h-8 w-8 shrink-0 text-faint" />
            <SectionHeading
              as="h2"
              size="display"
              titleClassName="text-xl font-bold leading-none text-muted"
              title={mode.name}
            />
          </div>
          <p className="flex items-center gap-2 text-sm text-muted">
            <LockIcon />
            <span>Coming soon</span>
          </p>
        </div>
      </article>
    );
  }

  return (
    <HubTile
      href={mode.entryHref!}
      size="hero"
      enterIndex={props.index ?? 0}
      title={mode.name}
      eyebrow={mode.tagline}
      art={
        <ModeIcon
          id={mode.id}
          className="hidden h-28 w-28 text-team-ink/70 sm:block"
        />
      }
    >
      <span className="block space-y-1">
        {mode.features.slice(0, 3).map((feature) => (
          <span key={feature} className="block text-soft">
            {feature}
          </span>
        ))}
      </span>
      <span className="mt-3 block font-medium text-team-ink">
        {mode.actionLabel} →
      </span>
    </HubTile>
  );
}
