import { Fragment } from "react";
import { OvrBadge, type OvrBadgeSize } from "@/components/ui/OvrBadge";
import { cn } from "@/components/ui/styles";
import { formatMoney } from "@/domain/owner-objective-text";
import { formatHeight } from "@/presentation/player-rating-categories";

/** Oldest age at which potential is still worth showing next to OVR. */
export const POTENTIAL_MAX_AGE = 24;

/** Potential is shown only when the view provides it and the player is young. */
export function showPotential(
  age: number,
  potential: number | null | undefined,
): potential is number {
  return potential != null && age <= POTENTIAL_MAX_AGE;
}

/** "$12.4M · 3y", or null without a contract. */
export function formatContractSummary(
  contract: {
    salary: number | null;
    yearsRemaining: number;
  } | null,
): string | null {
  if (!contract) return null;
  const parts = [
    contract.salary != null ? formatMoney(contract.salary) : null,
    `${contract.yearsRemaining}y`,
  ].filter(Boolean);
  return parts.join(" · ");
}

/**
 * The one quiet identity line under a player's name and archetype:
 * `#23 · SF · Age 24 · 6'7" · $12.4M · 3y`. Missing parts are omitted.
 */
export function PlayerIdentityLine(props: {
  jerseyNumber?: number;
  /** Leading context such as a team abbreviation. */
  lead?: string | null;
  position?: string;
  age?: number;
  heightInches?: number;
  contractSummary?: string | null;
  className?: string;
}) {
  const parts: Array<{ key: string; node: React.ReactNode }> = [];
  if (props.lead) parts.push({ key: "lead", node: props.lead });
  if (props.jerseyNumber != null) {
    parts.push({
      key: "jersey",
      node: <span className="tabular-nums">#{props.jerseyNumber}</span>,
    });
  }
  if (props.position) parts.push({ key: "pos", node: props.position });
  if (props.age != null) {
    parts.push({ key: "age", node: `Age ${props.age}` });
  }
  if (props.heightInches != null) {
    parts.push({ key: "height", node: formatHeight(props.heightInches) });
  }
  if (props.contractSummary) {
    parts.push({ key: "contract", node: props.contractSummary });
  }
  return (
    <p data-identity-line className={cn("text-sm text-muted", props.className)}>
      {parts.map((part, i) => (
        <Fragment key={part.key}>
          {i > 0 ? (
            <span aria-hidden className="mx-1">
              ·
            </span>
          ) : null}
          <span>{part.node}</span>
        </Fragment>
      ))}
    </p>
  );
}

const GHOST_SIZE: Record<OvrBadgeSize, OvrBadgeSize> = {
  xl: "lg",
  lg: "md",
  md: "sm",
  sm: "sm",
};

/** OVR badge plus a ghost POT badge one size smaller (young players only). */
export function OvrWithPotential(props: {
  overall: number;
  potential?: number | null;
  age: number;
  size: OvrBadgeSize;
  /** Stack vertically (default) or sit side by side. */
  direction?: "column" | "row";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        props.direction === "row" ? "flex-row" : "flex-col",
      )}
    >
      <OvrBadge overall={props.overall} size={props.size} />
      {showPotential(props.age, props.potential) ? (
        <OvrBadge
          ghost
          label="POT"
          overall={props.potential}
          size={GHOST_SIZE[props.size]}
        />
      ) : null}
    </div>
  );
}
