import { LogoFrame } from "@/components/team/logos/LogoFrame";

/** Fixed, team-neutral league colours; the ring keeps the edge on dark pages. */
const LEAGUE_COLORS = {
  primaryColor: "#FAFAFA",
  secondaryColor: "#18181B",
  accentColor: "#D4D4D8",
};

/**
 * The league office's mark: its abbreviation on the same 64×64 disc every
 * team logo uses. Decorative; the league name is always rendered beside it.
 */
export function LeagueMark(props: { letters: string; className?: string }) {
  const letters = props.letters.slice(0, 4).toUpperCase();
  return (
    <LogoFrame {...LEAGUE_COLORS} className={props.className} decorative>
      <text
        x="32"
        y="36"
        textAnchor="middle"
        fontSize={letters.length > 3 ? 13 : 16}
        fontWeight="800"
        fontFamily="system-ui, sans-serif"
        letterSpacing="1"
        fill={LEAGUE_COLORS.primaryColor}
      >
        {letters}
      </text>
      <rect
        x="22"
        y="42"
        width="20"
        height="2"
        rx="1"
        fill={LEAGUE_COLORS.accentColor}
      />
    </LogoFrame>
  );
}
