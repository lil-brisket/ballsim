import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import { readableTextOnBackground } from "@/domain/color-contrast";
import type { TeamLogoId } from "@/data/team-branding/logo-catalog";

export function TeamIdentityPreview(props: {
  city: string;
  nickname: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoId: TeamLogoId;
}) {
  const textColor = readableTextOnBackground(props.primaryColor);
  const mutedColor =
    textColor === "#FFFFFF" ? "rgba(255,255,255,0.75)" : "rgba(10,10,10,0.7)";

  return (
    <div
      className="flex flex-col items-center gap-4 rounded-xl border border-zinc-700/80 p-6 shadow-lg"
      style={{ backgroundColor: props.primaryColor }}
    >
      <TeamLogoMark
        logoId={props.logoId}
        primaryColor={props.primaryColor}
        secondaryColor={props.secondaryColor}
        accentColor={props.accentColor}
        className="h-28 w-28"
        title={`${props.city} ${props.nickname} logo`}
      />
      <div className="text-center">
        <p
          className="font-mono text-xs uppercase tracking-[0.2em]"
          style={{ color: mutedColor }}
        >
          {props.city}
        </p>
        <p
          className="text-3xl font-semibold tracking-tight"
          style={{ color: textColor }}
        >
          {props.nickname || "—"}
        </p>
      </div>
      <div className="flex gap-2" aria-label="Team colours">
        <span
          className="h-4 w-8 rounded border border-white/30"
          style={{ backgroundColor: props.primaryColor }}
          title="Primary"
        />
        <span
          className="h-4 w-8 rounded border border-white/30"
          style={{ backgroundColor: props.secondaryColor }}
          title="Secondary"
        />
        <span
          className="h-4 w-8 rounded border border-white/30"
          style={{ backgroundColor: props.accentColor }}
          title="Accent"
        />
      </div>
    </div>
  );
}
