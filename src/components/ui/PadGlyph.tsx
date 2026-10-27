import { cn } from "@/components/ui/styles";

/**
 * Generic controller glyphs (no console branding). Decorative: the visible
 * label next to them carries the meaning, so they are aria-hidden.
 */
export type PadGlyphName =
  "shoulders" | "dpad" | "faceBottom" | "faceRight" | "start" | "view";

const GLYPH_CLASS = "h-6 w-auto text-soft";

function Svg(props: { viewBox: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox={props.viewBox}
      className={GLYPH_CLASS}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {props.children}
    </svg>
  );
}

/** Four face-button dots in a diamond; the chosen one is filled. */
function Face(props: { filled: "bottom" | "right" }) {
  const dots = [
    { id: "top", cx: 12, cy: 5 },
    { id: "right", cx: 19, cy: 12 },
    { id: "bottom", cx: 12, cy: 19 },
    { id: "left", cx: 5, cy: 12 },
  ];
  return (
    <Svg viewBox="0 0 24 24">
      {dots.map((dot) => (
        <circle
          key={dot.id}
          cx={dot.cx}
          cy={dot.cy}
          r={3}
          fill={dot.id === props.filled ? "currentColor" : "none"}
        />
      ))}
    </Svg>
  );
}

export function PadGlyph(props: { name: PadGlyphName }) {
  switch (props.name) {
    case "shoulders":
      return (
        <Svg viewBox="0 0 36 24">
          <rect x="1.5" y="8" width="14" height="8" rx="4" />
          <rect x="20.5" y="8" width="14" height="8" rx="4" />
        </Svg>
      );
    case "dpad":
      return (
        <Svg viewBox="0 0 24 24">
          <path d="M9 2.5h6v6.5h6.5v6H15v6.5H9V15H2.5V9H9z" />
        </Svg>
      );
    case "faceBottom":
      return <Face filled="bottom" />;
    case "faceRight":
      return <Face filled="right" />;
    case "start":
      return (
        <Svg viewBox="0 0 24 24">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </Svg>
      );
    case "view":
      return (
        <Svg viewBox="0 0 24 24">
          <rect x="3" y="3" width="12" height="12" rx="2" />
          <rect x="9" y="9" width="12" height="12" rx="2" />
        </Svg>
      );
  }
}

/** Glyph with its visible label, the pad twin of KeyHint. */
export function PadHint(props: {
  glyph: PadGlyphName;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5", props.className)}
      data-pad-hint={props.glyph}
    >
      <PadGlyph name={props.glyph} />
      {props.label ? (
        <span className="text-sm text-muted">{props.label}</span>
      ) : null}
    </span>
  );
}
