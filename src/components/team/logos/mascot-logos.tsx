import { LogoFrame, type TeamLogoProps } from "./LogoFrame";

/** Existing — geometry unchanged from TeamLogoMark.tsx */
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

/** Existing — geometry unchanged from TeamLogoMark.tsx */
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

/** Existing — geometry unchanged from TeamLogoMark.tsx */
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

/** Existing — geometry unchanged from TeamLogoMark.tsx */
export function LionLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Lion"}>
      <circle cx="32" cy="32" r="16" fill={props.accentColor} />
      <circle cx="32" cy="32" r="11" fill={props.primaryColor} />
      <circle cx="27" cy="30" r="2" fill={props.secondaryColor} />
      <circle cx="37" cy="30" r="2" fill={props.secondaryColor} />
      <path
        d="M30 36 Q32 40 34 36"
        fill="none"
        stroke={props.accentColor}
        strokeWidth="2"
      />
    </LogoFrame>
  );
}

export function PantherLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Panther"}>
      {/* Low crouched profile head — distinct from wolf's upright jagged crown */}
      <path
        d="M10 38 L14 28 L20 34 L24 22 L30 30 L34 20 L40 30 L46 24 L52 34 L48 42 L16 42 Z"
        fill={props.primaryColor}
      />
      <circle cx="22" cy="34" r="2.2" fill={props.accentColor} />
      <path
        d="M36 32 L50 28 L46 36 Z"
        fill={props.accentColor}
      />
      <path
        d="M26 40 L30 46 L34 40"
        fill="none"
        stroke={props.secondaryColor}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </LogoFrame>
  );
}

/** Profile silhouette — distinct from eagle's spread wings */
export function FalconLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Falcon"}>
      <path
        d="M18 42 L28 20 L36 28 L44 14 L48 38 L36 34 L30 44 Z"
        fill={props.primaryColor}
      />
      <path d="M36 28 L44 14 L42 30 Z" fill={props.accentColor} />
      <circle cx="30" cy="26" r="1.8" fill={props.accentColor} />
    </LogoFrame>
  );
}

export function BullLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Bull"}>
      <path
        d="M12 28 L18 18 L22 28"
        fill="none"
        stroke={props.accentColor}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M52 28 L46 18 L42 28"
        fill="none"
        stroke={props.accentColor}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse cx="32" cy="36" rx="14" ry="12" fill={props.primaryColor} />
      <circle cx="26" cy="34" r="2" fill={props.accentColor} />
      <circle cx="38" cy="34" r="2" fill={props.accentColor} />
      <ellipse cx="32" cy="42" rx="4" ry="2.5" fill={props.secondaryColor} />
    </LogoFrame>
  );
}

/** Curled horns — distinct from bull's upward horns */
export function RamLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Ram"}>
      <path
        d="M16 34 Q12 22 20 18 Q26 16 24 28"
        fill="none"
        stroke={props.accentColor}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M48 34 Q52 22 44 18 Q38 16 40 28"
        fill="none"
        stroke={props.accentColor}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <ellipse cx="32" cy="36" rx="12" ry="11" fill={props.primaryColor} />
      <circle cx="27" cy="34" r="2" fill={props.secondaryColor} />
      <circle cx="37" cy="34" r="2" fill={props.secondaryColor} />
      <path d="M30 42 L32 46 L34 42 Z" fill={props.accentColor} />
    </LogoFrame>
  );
}

/** Branching antlers — distinct from ram/bull horns */
export function StagLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Stag"}>
      <path
        d="M22 28 L16 14 M22 28 L20 10 M22 28 L26 12"
        fill="none"
        stroke={props.accentColor}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M42 28 L48 14 M42 28 L44 10 M42 28 L38 12"
        fill="none"
        stroke={props.accentColor}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse cx="32" cy="38" rx="11" ry="10" fill={props.primaryColor} />
      <circle cx="27" cy="36" r="1.8" fill={props.accentColor} />
      <circle cx="37" cy="36" r="1.8" fill={props.accentColor} />
      <ellipse cx="32" cy="44" rx="3" ry="2" fill={props.secondaryColor} />
    </LogoFrame>
  );
}

export function SharkLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Shark"}>
      <path
        d="M10 36 Q20 20 36 28 L54 24 L48 34 L54 40 L36 36 Q24 42 14 40 Z"
        fill={props.primaryColor}
      />
      <path d="M28 28 L32 16 L36 28 Z" fill={props.accentColor} />
      <circle cx="40" cy="30" r="2" fill={props.accentColor} />
      <path
        d="M18 38 L22 42 L26 38"
        fill="none"
        stroke={props.secondaryColor}
        strokeWidth="1.5"
      />
    </LogoFrame>
  );
}

export function FoxLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Fox"}>
      {/* Tall pointed ears + diamond face — distinct from wolf/panther */}
      <path d="M18 34 L22 12 L28 30 Z" fill={props.primaryColor} />
      <path d="M46 34 L42 12 L36 30 Z" fill={props.primaryColor} />
      <path
        d="M20 34 L32 18 L44 34 L38 48 L26 48 Z"
        fill={props.primaryColor}
      />
      <path d="M22 12 L26 26 L28 30 Z" fill={props.accentColor} />
      <path d="M42 12 L38 26 L36 30 Z" fill={props.accentColor} />
      <circle cx="27" cy="34" r="2" fill={props.secondaryColor} />
      <circle cx="37" cy="34" r="2" fill={props.secondaryColor} />
      <ellipse cx="32" cy="42" rx="4" ry="2.5" fill={props.accentColor} />
    </LogoFrame>
  );
}

export function BisonLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Bison"}>
      <ellipse cx="32" cy="30" rx="16" ry="10" fill={props.accentColor} />
      <ellipse cx="32" cy="38" rx="12" ry="10" fill={props.primaryColor} />
      <path
        d="M18 28 L14 22 M46 28 L50 22"
        fill="none"
        stroke={props.accentColor}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="26" cy="36" r="2" fill={props.secondaryColor} />
      <circle cx="38" cy="36" r="2" fill={props.secondaryColor} />
      <ellipse cx="32" cy="44" rx="4" ry="2" fill={props.secondaryColor} />
    </LogoFrame>
  );
}

export function SnakeLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Snake"}>
      <path
        d="M16 40 Q22 20 32 32 Q42 44 48 24"
        fill="none"
        stroke={props.primaryColor}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <circle cx="48" cy="24" r="5" fill={props.primaryColor} />
      <circle cx="50" cy="22" r="1.5" fill={props.accentColor} />
      <path d="M52 26 L56 28" stroke={props.accentColor} strokeWidth="1.5" />
    </LogoFrame>
  );
}

export function OwlLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Owl"}>
      <ellipse cx="32" cy="36" rx="14" ry="16" fill={props.primaryColor} />
      <path d="M20 22 L24 14 L28 22 Z" fill={props.primaryColor} />
      <path d="M36 22 L40 14 L44 22 Z" fill={props.primaryColor} />
      <circle cx="26" cy="32" r="5" fill={props.accentColor} />
      <circle cx="38" cy="32" r="5" fill={props.accentColor} />
      <circle cx="26" cy="32" r="2" fill={props.secondaryColor} />
      <circle cx="38" cy="32" r="2" fill={props.secondaryColor} />
      <path d="M30 40 L32 46 L34 40 Z" fill={props.accentColor} />
    </LogoFrame>
  );
}
