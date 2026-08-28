import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import { toBrandingView } from "@/state/team-branding-view";

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
  const brandingView = toBrandingView(props.branding);

  return (
    <div className="flex items-center gap-3">
      {brandingView ? (
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-700"
          style={{ backgroundColor: brandingView.primaryColor }}
        >
          <TeamLogoMark
            branding={brandingView}
            size="md"
            title={`${props.city} ${props.name}`}
          />
        </span>
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-700/40 bg-amber-950/50 font-mono text-xs font-semibold text-amber-400">
          {props.abbreviation}
        </span>
      )}
      <div>
        <p className="text-sm font-medium text-zinc-100">
          {props.city} {props.name}
        </p>
        <p
          className={`font-mono text-xs ${brandingView ? "" : "text-zinc-500"}`}
          style={
            brandingView ? { color: brandingView.accentColor } : undefined
          }
        >
          {props.abbreviation}
        </p>
      </div>
    </div>
  );
}
