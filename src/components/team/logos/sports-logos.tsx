import { LogoFrame, type TeamLogoProps } from "./LogoFrame";

function BasketballBall(props: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  line: string;
}) {
  const { cx, cy, r, fill, line } = props;
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill={fill} />
      <path
        d={`M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={line}
        strokeWidth="1.5"
      />
      <path
        d={`M${cx} ${cy - r} L${cx} ${cy + r}`}
        fill="none"
        stroke={line}
        strokeWidth="1.5"
      />
      <path
        d={`M${cx - r * 0.7} ${cy - r * 0.5} Q${cx} ${cy} ${cx - r * 0.7} ${cy + r * 0.5}`}
        fill="none"
        stroke={line}
        strokeWidth="1.2"
      />
      <path
        d={`M${cx + r * 0.7} ${cy - r * 0.5} Q${cx} ${cy} ${cx + r * 0.7} ${cy + r * 0.5}`}
        fill="none"
        stroke={line}
        strokeWidth="1.2"
      />
    </>
  );
}

export function BasketballLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Basketball"}>
      <BasketballBall
        cx={32}
        cy={32}
        r={16}
        fill={props.primaryColor}
        line={props.accentColor}
      />
    </LogoFrame>
  );
}

/** Hoop-centric silhouette — distinct from ball mark */
export function BasketballHoopLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Hoop"}>
      <rect
        x="18"
        y="14"
        width="28"
        height="6"
        rx="1"
        fill={props.accentColor}
      />
      <ellipse
        cx="32"
        cy="28"
        rx="14"
        ry="5"
        fill="none"
        stroke={props.primaryColor}
        strokeWidth="3"
      />
      <path
        d="M20 30 L18 50 L24 46 L32 52 L40 46 L46 50 L44 30"
        fill="none"
        stroke={props.primaryColor}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M24 32 L26 44 M32 34 L32 48 M40 32 L38 44"
        fill="none"
        stroke={props.accentColor}
        strokeWidth="1.2"
      />
    </LogoFrame>
  );
}

/** Ball with motion/speed lines — distinct silhouette */
export function BasketballSpeedLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Speed Ball"}>
      <path
        d="M8 24 L20 24 M6 32 L18 32 M8 40 L20 40"
        fill="none"
        stroke={props.accentColor}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <BasketballBall
        cx={38}
        cy={32}
        r={14}
        fill={props.primaryColor}
        line={props.secondaryColor}
      />
    </LogoFrame>
  );
}

/** Winged ball — spread silhouette */
export function BasketballWingsLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Winged Ball"}>
      <path
        d="M8 36 Q18 18 28 30 L24 36 Q18 28 12 38 Z"
        fill={props.accentColor}
      />
      <path
        d="M56 36 Q46 18 36 30 L40 36 Q46 28 52 38 Z"
        fill={props.accentColor}
      />
      <BasketballBall
        cx={32}
        cy={34}
        r={11}
        fill={props.primaryColor}
        line={props.secondaryColor}
      />
    </LogoFrame>
  );
}

export function BasketballFlameLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Flame Ball"}>
      <path
        d="M32 8 C40 18 46 24 44 34 C42 28 36 26 32 20 C28 26 22 28 20 34 C18 24 24 18 32 8 Z"
        fill={props.accentColor}
      />
      <BasketballBall
        cx={32}
        cy={40}
        r={12}
        fill={props.primaryColor}
        line={props.secondaryColor}
      />
    </LogoFrame>
  );
}

export function BasketballClawLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Claw Ball"}>
      <BasketballBall
        cx={32}
        cy={34}
        r={13}
        fill={props.primaryColor}
        line={props.secondaryColor}
      />
      <path
        d="M14 20 L22 36 M22 16 L28 36 M32 14 L32 36 M42 16 L36 36 M50 20 L42 36"
        fill="none"
        stroke={props.accentColor}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </LogoFrame>
  );
}

export function BasketballCrownLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Crown Ball"}>
      <path
        d="M18 22 L22 12 L28 20 L32 10 L36 20 L42 12 L46 22 Z"
        fill={props.accentColor}
      />
      <BasketballBall
        cx={32}
        cy={40}
        r={12}
        fill={props.primaryColor}
        line={props.secondaryColor}
      />
    </LogoFrame>
  );
}

export function BasketballLightningLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Lightning Ball"}>
      <BasketballBall
        cx={28}
        cy={36}
        r={13}
        fill={props.primaryColor}
        line={props.secondaryColor}
      />
      <path
        d="M40 10 L32 28 H40 L34 52 L52 26 H42 Z"
        fill={props.accentColor}
        stroke={props.primaryColor}
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </LogoFrame>
  );
}

export function BasketballStarLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Star Ball"}>
      <path
        d="M32 8 L34 16 L42 16 L36 21 L38 29 L32 24 L26 29 L28 21 L22 16 L30 16 Z"
        fill={props.accentColor}
      />
      <BasketballBall
        cx={32}
        cy={40}
        r={12}
        fill={props.primaryColor}
        line={props.secondaryColor}
      />
    </LogoFrame>
  );
}
