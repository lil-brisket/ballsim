import type { TeamLogoId } from "@/data/team-branding/logo-catalog";
import type { ReactElement, ReactNode } from "react";

export type TeamLogoProps = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  className?: string;
  title?: string;
};

function LogoFrame(props: TeamLogoProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={props.title}
      className={props.className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="32" cy="32" r="30" fill={props.secondaryColor} />
      <circle
        cx="32"
        cy="32"
        r="28"
        fill="none"
        stroke={props.accentColor}
        strokeWidth="2"
      />
      {props.children}
    </svg>
  );
}

export function WolfLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Wolf"}>
      <path
        d="M16 38 L22 22 L28 30 L32 18 L36 30 L42 22 L48 38 Z"
        fill={props.primaryColor}
      />
      <circle cx="26" cy="34" r="2" fill={props.accentColor} />
      <circle cx="38" cy="34" r="2" fill={props.accentColor} />
      <path d="M30 40 L32 44 L34 40 Z" fill={props.accentColor} />
    </LogoFrame>
  );
}

export function BearLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Bear"}>
      <circle cx="20" cy="22" r="7" fill={props.primaryColor} />
      <circle cx="44" cy="22" r="7" fill={props.primaryColor} />
      <ellipse cx="32" cy="34" rx="16" ry="14" fill={props.primaryColor} />
      <circle cx="26" cy="32" r="2.5" fill={props.accentColor} />
      <circle cx="38" cy="32" r="2.5" fill={props.accentColor} />
      <ellipse cx="32" cy="40" rx="5" ry="3" fill={props.secondaryColor} />
    </LogoFrame>
  );
}

export function EagleLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Eagle"}>
      <path
        d="M12 36 Q32 10 52 36 L40 34 Q32 22 24 34 Z"
        fill={props.primaryColor}
      />
      <path d="M28 36 L32 28 L36 36 Z" fill={props.accentColor} />
      <circle cx="32" cy="40" r="4" fill={props.primaryColor} />
      <circle cx="33.5" cy="39" r="1.2" fill={props.accentColor} />
    </LogoFrame>
  );
}

export function LionLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Lion"}>
      <circle cx="32" cy="32" r="16" fill={props.accentColor} />
      <circle cx="32" cy="32" r="11" fill={props.primaryColor} />
      <circle cx="27" cy="30" r="2" fill={props.secondaryColor} />
      <circle cx="37" cy="30" r="2" fill={props.secondaryColor} />
      <path d="M30 36 Q32 40 34 36" fill="none" stroke={props.accentColor} strokeWidth="2" />
    </LogoFrame>
  );
}

export function LightningLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Lightning"}>
      <path
        d="M34 12 L22 34 H32 L28 52 L46 28 H34 Z"
        fill={props.primaryColor}
        stroke={props.accentColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </LogoFrame>
  );
}

export function FlameLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Flame"}>
      <path
        d="M32 12 C40 22 46 28 46 38 C46 46 40 52 32 52 C24 52 18 46 18 38 C18 30 24 24 28 20 C26 28 30 32 32 12 Z"
        fill={props.primaryColor}
      />
      <path
        d="M32 28 C36 34 38 36 38 40 C38 44 35 46 32 46 C29 46 26 44 26 40 C26 36 29 34 32 28 Z"
        fill={props.accentColor}
      />
    </LogoFrame>
  );
}

export function CrownLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Crown"}>
      <path
        d="M14 42 L18 24 L26 34 L32 18 L38 34 L46 24 L50 42 Z"
        fill={props.primaryColor}
      />
      <rect x="16" y="42" width="32" height="6" fill={props.accentColor} />
      <circle cx="18" cy="22" r="2.5" fill={props.accentColor} />
      <circle cx="32" cy="16" r="2.5" fill={props.accentColor} />
      <circle cx="46" cy="22" r="2.5" fill={props.accentColor} />
    </LogoFrame>
  );
}

export function ShieldLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Shield"}>
      <path
        d="M32 12 L48 18 V34 C48 44 40 50 32 54 C24 50 16 44 16 34 V18 Z"
        fill={props.primaryColor}
        stroke={props.accentColor}
        strokeWidth="2"
      />
      <path
        d="M32 20 L42 24 V34 C42 40 36 44 32 46 C28 44 22 40 22 34 V24 Z"
        fill={props.secondaryColor}
      />
    </LogoFrame>
  );
}

export function StarLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Star"}>
      <path
        d="M32 12 L36 26 L51 26 L39 35 L43 49 L32 40 L21 49 L25 35 L13 26 L28 26 Z"
        fill={props.primaryColor}
        stroke={props.accentColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </LogoFrame>
  );
}

export function MonogramLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Monogram"}>
      <rect
        x="18"
        y="18"
        width="28"
        height="28"
        rx="4"
        fill={props.primaryColor}
      />
      <text
        x="32"
        y="38"
        textAnchor="middle"
        fontSize="18"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        fill={props.accentColor}
      >
        T
      </text>
    </LogoFrame>
  );
}

const LOGO_COMPONENTS: Record<
  TeamLogoId,
  (props: TeamLogoProps) => ReactElement
> = {
  wolf: WolfLogo,
  bear: BearLogo,
  eagle: EagleLogo,
  lion: LionLogo,
  lightning: LightningLogo,
  flame: FlameLogo,
  crown: CrownLogo,
  shield: ShieldLogo,
  star: StarLogo,
  monogram: MonogramLogo,
};

export function TeamLogoMark(
  props: TeamLogoProps & { logoId: TeamLogoId },
) {
  const Component = LOGO_COMPONENTS[props.logoId] ?? ShieldLogo;
  return <Component {...props} />;
}
