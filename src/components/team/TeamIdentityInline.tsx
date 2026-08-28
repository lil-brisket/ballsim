import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import type { TeamBrandingView } from "@/state/team-branding-view";

export type TeamIdentityInlineProps = {
  city: string;
  name: string;
  abbreviation: string;
  branding: TeamBrandingView | null;
  size?: "sm" | "md";
};

/**
 * Compact team identity: [logo] City Name (ABBR).
 * Logo is decorative; the text provides the accessible name.
 */
export function TeamIdentityInline(props: TeamIdentityInlineProps) {
  const size = props.size ?? "sm";
  const monogramClass =
    size === "md"
      ? "h-8 w-8 text-xs"
      : "h-6 w-6 text-[10px]";

  return (
    <span className="inline-flex items-center gap-2">
      {props.branding ? (
        <span
          className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded border border-zinc-700 ${monogramClass}`}
          style={{ backgroundColor: props.branding.primaryColor }}
        >
          <TeamLogoMark
            branding={props.branding}
            size={size}
            decorative
          />
        </span>
      ) : (
        <span
          className={`inline-flex shrink-0 items-center justify-center rounded border border-amber-700/40 bg-amber-950/50 font-mono font-semibold text-amber-400 ${monogramClass}`}
        >
          {props.abbreviation}
        </span>
      )}
      <span className="min-w-0">
        {props.city} {props.name}{" "}
        <span className="font-mono text-zinc-500">({props.abbreviation})</span>
      </span>
    </span>
  );
}
