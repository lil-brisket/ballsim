import { InjuryBadge } from "@/components/basketball/InjuryBadge";
import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { OvrBadge } from "@/components/ui/OvrBadge";
import { cn, type Density } from "@/components/ui/styles";

/**
 * Compact roster list row. Prefer PlayerEntityLink for name clicks.
 */
export function RosterRow(props: {
  saveId: string;
  playerId: string;
  firstName: string;
  lastName: string;
  /** Saved jersey number; shown as a muted "#23" before the name when given. */
  jerseyNumber?: number;
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
      className={cn(
        "flex items-center gap-3 border-b border-line/80",
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
        {props.jerseyNumber != null ? (
          <span className="mr-1.5 text-sm tabular-nums text-faint">
            #{props.jerseyNumber}
          </span>
        ) : null}
        <PlayerEntityLink
          saveId={props.saveId}
          playerId={props.playerId}
          canOpen={props.canOpen}
          className="truncate text-sm text-team-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-team-ink"
        >
          {props.firstName} {props.lastName}
        </PlayerEntityLink>
        <p className="text-sm text-faint">
          {props.position}
          {props.age != null ? ` · ${props.age}` : ""}
        </p>
      </div>
      <OvrBadge overall={props.overall} size="sm" />
      {props.injuryStatus ? <InjuryBadge status={props.injuryStatus} /> : null}
    </div>
  );
}
