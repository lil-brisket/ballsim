import { LogoFrame, type TeamLogoProps } from "./LogoFrame";

/** Existing — geometry unchanged from TeamLogoMark.tsx */
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

/** Existing — geometry unchanged from TeamLogoMark.tsx */
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

/** Existing — geometry unchanged from TeamLogoMark.tsx */
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

/** Existing — geometry unchanged from TeamLogoMark.tsx */
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

export function CrestLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Crest"}>
      <path
        d="M32 10 L50 16 V30 C50 44 40 52 32 56 C24 52 14 44 14 30 V16 Z"
        fill={props.primaryColor}
        stroke={props.accentColor}
        strokeWidth="2"
      />
      <path
        d="M32 18 L42 22 V32 C42 40 36 46 32 48 C28 46 22 40 22 32 V22 Z"
        fill={props.secondaryColor}
      />
      <circle cx="32" cy="30" r="4" fill={props.accentColor} />
      <path
        d="M28 36 L32 40 L36 36"
        fill="none"
        stroke={props.accentColor}
        strokeWidth="1.5"
      />
    </LogoFrame>
  );
}

export function LaurelLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Laurel"}>
      <path
        d="M20 48 Q12 36 16 24 Q20 16 28 20"
        fill="none"
        stroke={props.primaryColor}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M44 48 Q52 36 48 24 Q44 16 36 20"
        fill="none"
        stroke={props.primaryColor}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <ellipse cx="18" cy="28" rx="4" ry="2.5" fill={props.accentColor} transform="rotate(-40 18 28)" />
      <ellipse cx="16" cy="36" rx="4" ry="2.5" fill={props.accentColor} transform="rotate(-20 16 36)" />
      <ellipse cx="20" cy="42" rx="4" ry="2.5" fill={props.accentColor} transform="rotate(-10 20 42)" />
      <ellipse cx="46" cy="28" rx="4" ry="2.5" fill={props.accentColor} transform="rotate(40 46 28)" />
      <ellipse cx="48" cy="36" rx="4" ry="2.5" fill={props.accentColor} transform="rotate(20 48 36)" />
      <ellipse cx="44" cy="42" rx="4" ry="2.5" fill={props.accentColor} transform="rotate(10 44 42)" />
      <circle cx="32" cy="28" r="6" fill={props.primaryColor} />
    </LogoFrame>
  );
}

export function PennantLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Pennant"}>
      <line
        x1="16"
        y1="12"
        x2="16"
        y2="52"
        stroke={props.accentColor}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M18 14 L50 28 L18 42 Z"
        fill={props.primaryColor}
        stroke={props.accentColor}
        strokeWidth="1"
      />
      <circle cx="26" cy="28" r="3" fill={props.secondaryColor} />
    </LogoFrame>
  );
}

export function RoundelLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Roundel"}>
      <circle
        cx="32"
        cy="32"
        r="18"
        fill={props.primaryColor}
        stroke={props.accentColor}
        strokeWidth="2"
      />
      <circle
        cx="32"
        cy="32"
        r="12"
        fill="none"
        stroke={props.secondaryColor}
        strokeWidth="3"
      />
      <circle cx="32" cy="32" r="5" fill={props.accentColor} />
    </LogoFrame>
  );
}

export function DiamondLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Diamond"}>
      <path
        d="M32 10 L52 32 L32 54 L12 32 Z"
        fill={props.primaryColor}
        stroke={props.accentColor}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M32 18 L44 32 L32 46 L20 32 Z"
        fill={props.secondaryColor}
      />
      <path
        d="M32 24 L38 32 L32 40 L26 32 Z"
        fill={props.accentColor}
      />
    </LogoFrame>
  );
}
