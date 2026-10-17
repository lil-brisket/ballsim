/**
 * Banner for destructive / high-impact Owner Mode actions.
 * Makes the active franchise unmistakable.
 */
import { ArenaPanel } from "@/components/ui/ArenaPanel";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { TeamThemeScope } from "@/components/ui/TeamThemeScope";

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
    <TeamThemeScope branding={props.branding}>
      <ArenaPanel
        as="div"
        edge="left"
        glow
        raised
        density="compact"
        className="flex items-center gap-3"
      >
        <TeamBadge
          branding={props.branding}
          name={`${props.city} ${props.name}`}
          size="sm"
        />
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold uppercase leading-tight tracking-wide text-zinc-50">
            {props.city} {props.name}
          </p>
          {props.actionLabel ? (
            <p className="text-sm text-team-ink">{props.actionLabel}</p>
          ) : null}
        </div>
      </ArenaPanel>
    </TeamThemeScope>
  );
}
