import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import type { TeamLogoId } from "@/data/team-branding/logo-catalog";
import { isTeamLogoId } from "@/data/team-branding/logo-catalog";

export function TeamBadge(props: {
  city: string;
  name: string;
  abbreviation: string;
  branding?: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    logoId: string;
  };
}) {
  const branding = props.branding;
  const logoId =
    branding && isTeamLogoId(branding.logoId)
      ? (branding.logoId as TeamLogoId)
      : null;

  return (
    <div className="flex items-center gap-3">
      {branding && logoId ? (
        <span
          className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-zinc-700"
          style={{ backgroundColor: branding.primaryColor }}
        >
          <TeamLogoMark
            logoId={logoId}
            primaryColor={branding.primaryColor}
            secondaryColor={branding.secondaryColor}
            accentColor={branding.accentColor}
            className="h-8 w-8"
            title={props.abbreviation}
          />
        </span>
      ) : (
        <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-700/40 bg-amber-950/50 font-mono text-xs font-semibold text-amber-400">
          {props.abbreviation}
        </span>
      )}
      <div>
        <p className="text-sm font-medium text-zinc-100">
          {props.city} {props.name}
        </p>
        <p
          className={`font-mono text-xs ${branding ? "" : "text-zinc-500"}`}
          style={branding ? { color: branding.accentColor } : undefined}
        >
          {props.abbreviation}
        </p>
      </div>
    </div>
  );
}
