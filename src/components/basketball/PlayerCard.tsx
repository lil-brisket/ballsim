import { InjuryBadge } from "@/components/basketball/InjuryBadge";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import {
  OvrWithPotential,
  PlayerIdentityLine,
} from "@/components/basketball/PlayerIdentityLine";
import { ratingTier } from "@/presentation/rating-tier";
import {
  cn,
  densityPadding,
  displayClass,
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
  archetypeLabel?: string;
  heightInches?: number;
  /** Shown as ghost POT beside OVR for players aged 24 or younger. */
  potential?: number;
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
            <SectionHeading
              as="h3"
              size="sm"
              titleClassName="truncate text-base!"
              title={name}
            />
            {props.archetypeLabel ? (
              <p className={cn(displayClass, "mt-0.5 truncate text-base")}>
                {props.archetypeLabel}
              </p>
            ) : null}
            <PlayerIdentityLine
              className="mt-0.5"
              position={fields.position ? props.position : undefined}
              age={fields.age ? props.age : undefined}
              heightInches={props.heightInches}
              contractSummary={fields.contract ? props.contractLabel : null}
              lead={fields.role ? props.role : null}
            />
          </div>
        </div>
        {fields.overall && props.overall != null ? (
          <OvrWithPotential
            overall={props.overall}
            potential={props.potential}
            age={props.age ?? 99}
            size="lg"
          />
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {fields.injury && props.injuryStatus ? (
          <InjuryBadge status={props.injuryStatus} />
        ) : null}
      </div>

      {fields.team && props.teamName ? (
        <p className="mt-3 text-sm text-muted">
          {props.teamAbbreviation
            ? `${props.teamAbbreviation} · ${props.teamName}`
            : props.teamName}
        </p>
      ) : null}
    </article>
  );
}
