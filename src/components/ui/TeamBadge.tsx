import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import { cn } from "@/components/ui/styles";
import { toBrandingView } from "@/state/team-branding-view";

export type TeamBadgeSize = "sm" | "md" | "lg" | "xl";

const PLATE: Record<TeamBadgeSize, string> = {
  sm: "h-8 w-8 rounded-md",
  md: "h-11 w-11 rounded-lg",
  lg: "h-16 w-16 rounded-xl",
  xl: "h-24 w-24 rounded-2xl",
};

const MARK: Record<TeamBadgeSize, string> = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-12 w-12",
  xl: "h-[4.5rem] w-[4.5rem]",
};

const INITIALS: Record<TeamBadgeSize, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-xl",
  xl: "text-3xl",
};

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

/**
 * Team logo mark on a plate in the team's primary colour, ringed with the
 * secondary. Falls back to an initials plate when branding is missing.
 * Uses the team's own colours (not the surrounding `--team-*` scope) so an
 * opponent badge renders correctly inside the user's themed shell.
 */
export function TeamBadge(props: {
  branding:
    | {
        primaryColor: string;
        secondaryColor: string;
        accentColor: string;
        logoId: string;
      }
    | null
    | undefined;
  /** Team name for the accessible label and the initials fallback. */
  name: string;
  size?: TeamBadgeSize;
  /** Hide from assistive tech when the team name is printed next to it. */
  decorative?: boolean;
  className?: string;
}) {
  const size = props.size ?? "md";
  const branding = toBrandingView(props.branding);
  const labelProps = props.decorative
    ? { "aria-hidden": true }
    : { role: "img", "aria-label": props.name };

  if (!branding) {
    return (
      <span
        {...labelProps}
        className={cn(
          "inline-flex shrink-0 items-center justify-center border border-line-strong bg-surface-high font-display font-bold text-ink",
          PLATE[size],
          INITIALS[size],
          props.className,
        )}
      >
        {initialsOf(props.name)}
      </span>
    );
  }

  return (
    <span
      {...labelProps}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden",
        PLATE[size],
        props.className,
      )}
      style={{
        backgroundColor: branding.primaryColor,
        boxShadow: `inset 0 0 0 2px ${branding.secondaryColor}, var(--shadow-arena)`,
      }}
    >
      <TeamLogoMark branding={branding} className={MARK[size]} decorative />
    </span>
  );
}
