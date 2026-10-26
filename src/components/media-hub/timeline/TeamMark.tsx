import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import type { TeamLogoSize } from "@/components/team/logos/TeamLogoMark";
import { cn } from "@/components/ui/styles";
import type { TeamBrandingView } from "@/state/team-branding-view";

const PLACEHOLDER_SIZE: Record<TeamLogoSize, string> = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

/** Decorative team logo; a neutral disc when branding is missing. */
export function TeamMark(props: {
  branding: TeamBrandingView | null;
  size: TeamLogoSize;
}) {
  if (!props.branding) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "inline-block shrink-0 rounded-full bg-line-strong",
          PLACEHOLDER_SIZE[props.size],
        )}
      />
    );
  }
  return (
    <TeamLogoMark branding={props.branding} size={props.size} decorative />
  );
}
