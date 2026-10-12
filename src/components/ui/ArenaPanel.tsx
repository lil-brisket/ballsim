import type { CSSProperties } from "react";
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
      className={cn("arena-panel", densityPadding[density], props.className)}
      data-edge={props.edge && props.edge !== "none" ? props.edge : undefined}
      data-glow={props.glow ? "true" : undefined}
      data-hero={props.hero ? "true" : undefined}
      data-raised={props.raised ? "true" : undefined}
      style={props.style}
      aria-labelledby={props["aria-labelledby"]}
    >
      {props.children}
    </Tag>
  );
}
