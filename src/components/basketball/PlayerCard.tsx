import { InjuryBadge } from "@/components/basketball/InjuryBadge";
import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import { ScoreNumeral } from "@/components/ui/ScoreNumeral";
import { ratingTier } from "@/presentation/rating-tier";
import {
  cn,
  densityPadding,
  panelClass,
  type Density,
} from "@/components/ui/styles";

export type PlayerCardFields = {
  position?: boolean;
  overall?: boolean;
  age?: boolean;
  team?: boolean;
  role?: boolean;
  contract?: boolean;
  injury?: boolean;
};

const DEFAULT_FIELDS: Required<PlayerCardFields> = {
  position: true,
  overall: true,
  age: true,
  team: true,
  role: false,
  contract: false,
  injury: true,
};

/**
 * Generic player representation. Not draft-specific (ProspectCard) or
 * rotation-specific (RotationPlayerCard).
 */
export function PlayerCard(props: {
  playerId: string;
  firstName: string;
  lastName: string;
  /** Persisted portrait from the view model; null/absent → initials plate. */
  portrait?: PlayerPortraitAssignment | null;
  position?: string;
  overall?: number;
  age?: number;
  teamName?: string | null;
  teamAbbreviation?: string | null;
  role?: string | null;
  contractLabel?: string | null;
  injuryStatus?: string | null;
  fields?: PlayerCardFields;
  density?: Density;
  className?: string;
  /** When true, omit panel chrome (for use inside Drawer). */
  bare?: boolean;
}) {
  const fields = { ...DEFAULT_FIELDS, ...props.fields };
  const density = props.density ?? "default";
  const name = `${props.firstName} ${props.lastName}`;

  return (
    <article
      data-tier={
        props.overall != null ? ratingTier(props.overall).id : undefined
      }
      className={cn(
        !props.bare && panelClass,
        !props.bare && props.overall != null && "border-l-4 border-l-tier",
        !props.bare && densityPadding[density],
        props.className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <PlayerPortrait
            playerId={props.playerId}
            firstName={props.firstName}
            lastName={props.lastName}
            portrait={props.portrait}
            size="md"
          />
          <div className="min-w-0">
            <h3 className="truncate text-base font-medium text-zinc-50">
              {name}
            </h3>
            <p className="mt-0.5 text-xs text-zinc-400">
              {[
                fields.position && props.position,
                fields.age && props.age != null ? `Age ${props.age}` : null,
                fields.role && props.role,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        {fields.overall && props.overall != null ? (
          <ScoreNumeral
            value={props.overall}
            label="OVR"
            labelBelow
            size="md"
            tone="tier"
            align="end"
            className="shrink-0"
          />
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {fields.injury && props.injuryStatus ? (
          <InjuryBadge status={props.injuryStatus} />
        ) : null}
        {fields.contract && props.contractLabel ? (
          <span className="text-xs text-zinc-400">{props.contractLabel}</span>
        ) : null}
      </div>

      {fields.team && props.teamName ? (
        <p className="mt-3 text-xs text-zinc-400">
          {props.teamAbbreviation
            ? `${props.teamAbbreviation} · ${props.teamName}`
            : props.teamName}
        </p>
      ) : null}
    </article>
  );
}
