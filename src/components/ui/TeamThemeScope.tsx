import type { CSSProperties } from "react";
import { cn } from "@/components/ui/styles";
import { teamThemeVars, type TeamThemeColors } from "@/presentation/team-theme";

/** Inline style that sets the `--team-*` variables for a subtree. */
export function teamThemeStyle(
  colors: TeamThemeColors | null | undefined,
): CSSProperties {
  return teamThemeVars(colors) as CSSProperties;
}

/**
 * Scopes team-colour theming to its children. Everything below inherits
 * `--team-primary`, `--team-ink`, etc. Missing branding keeps the amber default.
 */
export function TeamThemeScope(props: {
  branding: TeamThemeColors | null | undefined;
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "main";
}) {
  const Tag = props.as ?? "div";
  return (
    <Tag className={cn(props.className)} style={teamThemeStyle(props.branding)}>
      {props.children}
    </Tag>
  );
}
