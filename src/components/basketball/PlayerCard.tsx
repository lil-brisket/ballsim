import { InjuryBadge } from "@/components/basketball/InjuryBadge";
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
  firstName: string;
  lastName: string;
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
      className={cn(
        !props.bare && panelClass,
        !props.bare && densityPadding[density],
        props.className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
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
        {fields.overall && props.overall != null ? (
          <div className="shrink-0 text-right">
            <p className="text-lg font-semibold text-amber-400">
              {props.overall}
            </p>
            <p className="font-mono text-[0.6rem] uppercase tracking-wide text-zinc-500">
              OVR
            </p>
          </div>
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
