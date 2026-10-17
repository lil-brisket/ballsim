import type { CSSProperties } from "react";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import type { TeamBrandingView } from "@/state/team-branding-view";
import { cn, densityPadding, type Density } from "@/components/ui/styles";

/**
 * Broadcast-style surface for hero and primary content. Prefer over `Panel`
 * where a section should carry weight; `Panel` stays for quiet secondary boxes.
 *
 * - `edge`: team-colour bar on the left or top edge.
 * - `glow`: team-colour outer glow.
 * - `hero`: team-colour wash with a slow sheen (static under reduced motion).
 * - `raised`: lighter surface for panels nested in an arena background.
 */
export function ArenaPanel(props: {
  children: React.ReactNode;
  density?: Density;
  edge?: "none" | "left" | "top";
  glow?: boolean;
  hero?: boolean;
  raised?: boolean;
  /** Subtle hardwood texture. Hero surfaces only. */
  texture?: boolean;
  /** Faded team logo behind the content, clipped by the panel. */
  watermark?: TeamBrandingView;
  className?: string;
  /** e.g. `{ "--i": 2 }` to stagger an `.enter-up` entrance. */
  style?: CSSProperties;
  as?: "div" | "section" | "article" | "header" | "aside";
  "aria-labelledby"?: string;
}) {
  const Tag = props.as ?? "section";
  const density = props.density ?? "default";
  return (
    <Tag
      className={cn(
        "arena-panel",
        props.texture && "surface-hardwood",
        densityPadding[density],
        props.className,
      )}
      data-edge={props.edge && props.edge !== "none" ? props.edge : undefined}
      data-glow={props.glow ? "true" : undefined}
      data-hero={props.hero ? "true" : undefined}
      data-raised={props.raised ? "true" : undefined}
      style={props.style}
      aria-labelledby={props["aria-labelledby"]}
    >
      {props.watermark ? (
        <div aria-hidden="true" className="panel-watermark">
          <TeamLogoMark branding={props.watermark} decorative />
        </div>
      ) : null}
      {props.children}
    </Tag>
  );
}
