import { TeamBadge, type TeamBadgeSize } from "@/components/ui/TeamBadge";
import { cn } from "@/components/ui/styles";

/**
 * Team logo plate with the full team name and abbreviation beside it. Use
 * where a team is identified by name; use `TeamBadge` alone for the plate.
 */
export function TeamLabel(props: {
  city: string;
  name: string;
  abbreviation: string;
  branding?: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    logoId: string;
  } | null;
  size?: TeamBadgeSize;
  className?: string;
}) {
  const fullName = `${props.city} ${props.name}`;
  return (
    <div className={cn("flex items-center gap-3", props.className)}>
      <TeamBadge
        branding={props.branding}
        name={fullName}
        size={props.size ?? "md"}
        decorative
      />
      <div>
        <p className="text-sm font-medium text-ink">{fullName}</p>
        <p className="text-sm text-muted">{props.abbreviation}</p>
      </div>
    </div>
  );
}
