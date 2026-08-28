import { LogoFrame, type TeamLogoProps } from "./LogoFrame";

export function MountainLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Mountain"}>
      <path
        d="M6 48 L20 24 L28 36 L38 16 L58 48 Z"
        fill={props.primaryColor}
      />
      <path d="M20 24 L24 32 L28 36 L38 16 Z" fill={props.accentColor} />
      <path
        d="M6 48 H58"
        fill="none"
        stroke={props.secondaryColor}
        strokeWidth="2"
      />
    </LogoFrame>
  );
}

/** Coastal/geographic wave — distinct from aggressive wave-surge */
export function WaveLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Wave"}>
      <path
        d="M8 36 Q18 24 28 36 Q38 48 48 28 Q52 36 56 34 L56 48 L8 48 Z"
        fill={props.primaryColor}
      />
      <path
        d="M8 32 Q18 20 28 32 Q38 44 50 24"
        fill="none"
        stroke={props.accentColor}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </LogoFrame>
  );
}

export function SkylineLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Skyline"}>
      <rect x="10" y="28" width="10" height="24" fill={props.primaryColor} />
      <rect x="22" y="18" width="8" height="34" fill={props.primaryColor} />
      <rect x="32" y="24" width="12" height="28" fill={props.primaryColor} />
      <rect x="46" y="32" width="8" height="20" fill={props.primaryColor} />
      <rect x="12" y="32" width="2" height="2" fill={props.accentColor} />
      <rect x="16" y="36" width="2" height="2" fill={props.accentColor} />
      <rect x="24" y="24" width="2" height="2" fill={props.accentColor} />
      <rect x="26" y="30" width="2" height="2" fill={props.accentColor} />
      <rect x="36" y="30" width="2" height="2" fill={props.accentColor} />
      <rect x="40" y="36" width="2" height="2" fill={props.accentColor} />
      <path d="M22 18 L26 12 L30 18" fill={props.accentColor} />
    </LogoFrame>
  );
}

export function BridgeLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Bridge"}>
      <path
        d="M8 40 Q32 16 56 40"
        fill="none"
        stroke={props.primaryColor}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="16"
        y1="34"
        x2="16"
        y2="48"
        stroke={props.accentColor}
        strokeWidth="2"
      />
      <line
        x1="32"
        y1="20"
        x2="32"
        y2="48"
        stroke={props.accentColor}
        strokeWidth="2.5"
      />
      <line
        x1="48"
        y1="34"
        x2="48"
        y2="48"
        stroke={props.accentColor}
        strokeWidth="2"
      />
      <path
        d="M8 48 H56"
        fill="none"
        stroke={props.primaryColor}
        strokeWidth="3"
      />
    </LogoFrame>
  );
}

export function PalmTreeLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Palm"}>
      <path
        d="M30 52 L32 28 L34 52 Z"
        fill={props.primaryColor}
      />
      <path
        d="M32 28 Q18 20 12 28 Q22 26 32 32"
        fill={props.accentColor}
      />
      <path
        d="M32 28 Q46 20 52 28 Q42 26 32 32"
        fill={props.accentColor}
      />
      <path
        d="M32 26 Q24 12 18 16 Q28 18 32 28"
        fill={props.primaryColor}
      />
      <path
        d="M32 26 Q40 12 46 16 Q36 18 32 28"
        fill={props.primaryColor}
      />
    </LogoFrame>
  );
}

export function PineTreeLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Pine"}>
      <path d="M32 10 L44 28 H36 L48 40 H34 L50 52 H14 L30 40 H16 L28 28 H20 Z" fill={props.primaryColor} />
      <rect x="29" y="50" width="6" height="6" fill={props.accentColor} />
    </LogoFrame>
  );
}

export function LighthouseLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Lighthouse"}>
      <path d="M26 48 L28 24 H36 L38 48 Z" fill={props.primaryColor} />
      <rect x="24" y="20" width="16" height="6" fill={props.accentColor} />
      <path d="M28 20 L32 12 L36 20 Z" fill={props.primaryColor} />
      <path
        d="M36 16 L52 12 M36 20 L52 24"
        fill="none"
        stroke={props.accentColor}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect x="29" y="30" width="3" height="4" fill={props.secondaryColor} />
      <rect x="34" y="38" width="3" height="4" fill={props.secondaryColor} />
      <path d="M18 48 H46" stroke={props.accentColor} strokeWidth="3" />
    </LogoFrame>
  );
}

export function CompassLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Compass"}>
      <circle
        cx="32"
        cy="32"
        r="18"
        fill="none"
        stroke={props.primaryColor}
        strokeWidth="3"
      />
      <path d="M32 14 L36 32 L32 50 L28 32 Z" fill={props.primaryColor} />
      <path d="M14 32 L32 28 L50 32 L32 36 Z" fill={props.accentColor} />
      <circle cx="32" cy="32" r="3" fill={props.secondaryColor} />
    </LogoFrame>
  );
}

export function SunLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Sun"}>
      <circle cx="32" cy="32" r="10" fill={props.primaryColor} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = 32 + Math.cos(rad) * 14;
        const y1 = 32 + Math.sin(rad) * 14;
        const x2 = 32 + Math.cos(rad) * 22;
        const y2 = 32 + Math.sin(rad) * 22;
        return (
          <line
            key={deg}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={props.accentColor}
            strokeWidth="3"
            strokeLinecap="round"
          />
        );
      })}
    </LogoFrame>
  );
}

export function GlobeLogo(props: TeamLogoProps) {
  return (
    <LogoFrame {...props} title={props.title ?? "Globe"}>
      <circle
        cx="32"
        cy="32"
        r="16"
        fill={props.primaryColor}
        stroke={props.accentColor}
        strokeWidth="2"
      />
      <ellipse
        cx="32"
        cy="32"
        rx="8"
        ry="16"
        fill="none"
        stroke={props.secondaryColor}
        strokeWidth="1.5"
      />
      <path
        d="M16 32 H48"
        fill="none"
        stroke={props.secondaryColor}
        strokeWidth="1.5"
      />
      <path
        d="M18 24 H46 M18 40 H46"
        fill="none"
        stroke={props.accentColor}
        strokeWidth="1"
      />
    </LogoFrame>
  );
}
