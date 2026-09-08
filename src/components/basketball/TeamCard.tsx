import { TeamBadge } from "@/components/owner/TeamBadge";
import { Metric } from "@/components/ui/Metric";
import {
  cn,
  densityPadding,
  panelClass,
  type Density,
} from "@/components/ui/styles";

/**
 * Generic team representation for cards and drawer headers.
 */
export function TeamCard(props: {
  city: string;
  name: string;
  abbreviation: string;
  branding?: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    logoId: string;
  } | null;
  wins?: number;
  losses?: number;
  conference?: string | null;
  division?: string | null;
  rank?: number | null;
  density?: Density;
  className?: string;
  bare?: boolean;
}) {
  const density = props.density ?? "default";
  const record =
    props.wins != null && props.losses != null
      ? `${props.wins}–${props.losses}`
      : null;

  return (
    <article
      className={cn(
        !props.bare && panelClass,
        !props.bare && densityPadding[density],
        props.className,
      )}
    >
      <TeamBadge
        city={props.city}
        name={props.name}
        abbreviation={props.abbreviation}
        branding={props.branding ?? undefined}
      />
      <div className="mt-3 flex flex-wrap gap-4">
        {record ? (
          <Metric label="Record" value={record} mono density="compact" />
        ) : null}
        {props.rank != null ? (
          <Metric label="Rank" value={`#${props.rank}`} mono density="compact" />
        ) : null}
        {props.conference ? (
          <Metric
            label="Conference"
            value={props.conference}
            density="compact"
          />
        ) : null}
        {props.division ? (
          <Metric label="Division" value={props.division} density="compact" />
        ) : null}
      </div>
    </article>
  );
}
