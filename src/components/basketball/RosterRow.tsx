import { InjuryBadge } from "@/components/basketball/InjuryBadge";
import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { ratingTier } from "@/presentation/rating-tier";
import { cn, type Density } from "@/components/ui/styles";

/**
 * Compact roster list row. Prefer PlayerEntityLink for name clicks.
 */
export function RosterRow(props: {
  saveId: string;
  playerId: string;
  firstName: string;
  lastName: string;
  /** Persisted portrait from the view model; null/absent → initials plate. */
  portrait?: PlayerPortraitAssignment | null;
  position: string;
  overall: number;
  age?: number;
  injuryStatus?: string;
  density?: Density;
  className?: string;
  canOpen?: boolean;
}) {
  const dense = props.density === "compact" || props.density == null;
  return (
    <div
      data-tier={ratingTier(props.overall).id}
      className={cn(
        "flex items-center gap-3 border-b border-zinc-800/80",
        dense ? "py-1.5" : "py-2.5",
        props.className,
      )}
    >
      <PlayerPortrait
        playerId={props.playerId}
        firstName={props.firstName}
        lastName={props.lastName}
        portrait={props.portrait}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <PlayerEntityLink
          saveId={props.saveId}
          playerId={props.playerId}
          canOpen={props.canOpen}
          className="truncate text-sm text-team-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          {props.firstName} {props.lastName}
        </PlayerEntityLink>
        <p className="text-xs text-zinc-500">
          {props.position}
          {props.age != null ? ` · ${props.age}` : ""}
        </p>
      </div>
      <span className="shrink-0 font-display text-xl font-bold tabular-nums text-tier">
        {props.overall}
      </span>
      {props.injuryStatus ? <InjuryBadge status={props.injuryStatus} /> : null}
    </div>
  );
}
