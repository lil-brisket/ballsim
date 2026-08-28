import { LogoFrame, type TeamLogoProps } from "./LogoFrame";

/** Existing — geometry unchanged from TeamLogoMark.tsx */
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

/** Existing — geometry unchanged from TeamLogoMark.tsx */
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

export function ClawMarksLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Claw Marks"}>
      <path
        d="M16 16 L24 48"
        fill="none"
        stroke={props.primaryColor}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M28 12 L34 50"
        fill="none"
        stroke={props.primaryColor}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M40 16 L46 48"
        fill="none"
        stroke={props.primaryColor}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M18 18 L26 46"
        fill="none"
        stroke={props.accentColor}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </LogoFrame>
  );
}

export function FangLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Fang"}>
      <path
        d="M20 18 L28 48 L32 28 L36 48 L44 18 Q32 28 20 18 Z"
        fill={props.primaryColor}
      />
      <path d="M28 48 L32 28 L36 48 Z" fill={props.accentColor} />
    </LogoFrame>
  );
}

export function HornsLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Horns"}>
      <path
        d="M12 42 Q16 20 28 28 L26 36 Q20 30 16 42 Z"
        fill={props.primaryColor}
      />
      <path
        d="M52 42 Q48 20 36 28 L38 36 Q44 30 48 42 Z"
        fill={props.primaryColor}
      />
      <path
        d="M14 28 Q20 16 28 24"
        fill="none"
        stroke={props.accentColor}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M50 28 Q44 16 36 24"
        fill="none"
        stroke={props.accentColor}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </LogoFrame>
  );
}

export function MeteorLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Meteor"}>
      <path
        d="M12 48 L28 28 L22 34 L36 16"
        fill="none"
        stroke={props.accentColor}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 44 L32 24"
        fill="none"
        stroke={props.primaryColor}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="42" cy="20" r="10" fill={props.primaryColor} />
      <circle cx="40" cy="18" r="3" fill={props.accentColor} />
    </LogoFrame>
  );
}

export function TornadoLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Tornado"}>
      <path
        d="M18 16 Q32 12 46 16"
        fill="none"
        stroke={props.primaryColor}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M22 26 Q32 22 42 26"
        fill="none"
        stroke={props.primaryColor}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M26 36 Q32 33 38 36"
        fill="none"
        stroke={props.accentColor}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M28 46 Q32 44 36 46"
        fill="none"
        stroke={props.accentColor}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M30 54 L34 54"
        fill="none"
        stroke={props.primaryColor}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </LogoFrame>
  );
}

export function MountainPeakLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Peak"}>
      <path
        d="M8 48 L24 20 L32 32 L40 14 L56 48 Z"
        fill={props.primaryColor}
      />
      <path d="M24 20 L28 28 L32 32 L40 14 Z" fill={props.accentColor} />
      <path
        d="M20 48 L32 28 L44 48"
        fill="none"
        stroke={props.secondaryColor}
        strokeWidth="1.5"
      />
    </LogoFrame>
  );
}

export function WaveSurgeLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Surge"}>
      <path
        d="M8 40 Q18 20 28 36 Q36 48 48 22 L56 28 Q42 52 30 40 Q20 28 12 44 Z"
        fill={props.primaryColor}
      />
      <path
        d="M14 44 Q24 28 32 42 Q40 52 50 30"
        fill="none"
        stroke={props.accentColor}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </LogoFrame>
  );
}

export function StarburstLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Starburst"}>
      <path
        d="M32 8 L36 26 L54 22 L40 32 L54 42 L36 38 L32 56 L28 38 L10 42 L24 32 L10 22 L28 26 Z"
        fill={props.primaryColor}
        stroke={props.accentColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="32" r="5" fill={props.accentColor} />
    </LogoFrame>
  );
}
