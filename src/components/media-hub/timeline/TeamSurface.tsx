import type { ReactNode } from "react";
import { TeamThemeScope } from "@/components/ui/TeamThemeScope";
import { cn, panelClass } from "@/components/ui/styles";
import type { TeamBrandingView } from "@/state/team-branding-view";

export type TeamSurfaceBand = "left" | "top";

const BAND_CLASS: Record<TeamSurfaceBand, string> = {
  left: "absolute inset-y-0 left-0 w-1.5",
  top: "absolute inset-x-0 top-0 h-1.5",
};
// Content clears the band.
const PADDING_CLASS: Record<TeamSurfaceBand, string> = {
  left: "p-4 pl-5",
  top: "p-4 pt-5",
};

/**
 * The one card surface for timeline attachments: a neutral panel with a thin
 * team-ink band. Ink (not primary) keeps the band visible for very dark teams.
 */
export function TeamSurface(props: {
  branding: TeamBrandingView | null;
  band?: TeamSurfaceBand;
  className?: string;
  children: ReactNode;
}) {
  const band = props.band ?? "left";
  return (
    <TeamThemeScope
      branding={props.branding}
      className={cn(panelClass, "relative overflow-hidden", props.className)}
    >
      <span
        aria-hidden="true"
        data-team-band={band}
        className={cn(BAND_CLASS[band], "bg-team-ink")}
      />
      <div className={PADDING_CLASS[band]}>{props.children}</div>
    </TeamThemeScope>
  );
}

/** Solid team-colour header slab for names and titles inside a TeamSurface. */
export function TeamSurfaceSlab(props: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-team px-4 py-2 text-on-team", props.className)}>
      {props.children}
    </div>
  );
}
