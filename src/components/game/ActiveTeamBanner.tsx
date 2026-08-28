/**
 * Banner for destructive / high-impact Owner Mode actions.
 * Makes the active franchise unmistakable.
 */
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";

export function ActiveTeamBanner(props: {
  city: string;
  name: string;
  branding: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    logoId: string;
  };
  actionLabel?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-800/50 bg-amber-950/30 px-3 py-2">
      <span
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-700"
        style={{ backgroundColor: props.branding.primaryColor }}
      >
        <TeamLogoMark
          branding={props.branding}
          size="sm"
          title={`${props.city} ${props.name}`}
        />
      </span>
      <div className="min-w-0">
        <p className="truncate font-medium text-amber-100">
          {props.city} {props.name}
        </p>
        {props.actionLabel ? (
          <p className="text-xs text-amber-200/80">{props.actionLabel}</p>
        ) : null}
      </div>
    </div>
  );
}
