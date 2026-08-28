import type { TeamLogoId } from "@/data/team-branding/logo-catalog";
import { isTeamLogoId } from "@/data/team-branding/logo-catalog";
import type { TeamBrandingView } from "@/state/team-branding-view";
import type { TeamLogoProps } from "./LogoFrame";
import { LOGO_COMPONENTS, ShieldLogo } from "./logo-registry";

export type { TeamLogoProps } from "./LogoFrame";

export type TeamLogoSize = "sm" | "md" | "lg";

const SIZE_CLASS: Record<TeamLogoSize, string> = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

type TeamLogoMarkBaseProps = {
  size?: TeamLogoSize;
  className?: string;
  title?: string;
  /** Decorative when beside team name text. Meaningful when logo stands alone. */
  decorative?: boolean;
};

/** Preferred API — pass branding from view models. */
type TeamLogoMarkBrandingProps = TeamLogoMarkBaseProps & {
  branding: TeamBrandingView;
  logoId?: never;
  primaryColor?: never;
  secondaryColor?: never;
  accentColor?: never;
};

/** Legacy API — individual colour props (identity builder / showcase). */
type TeamLogoMarkLegacyProps = TeamLogoMarkBaseProps & {
  branding?: undefined;
  logoId: TeamLogoId;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

export type TeamLogoMarkProps =
  | TeamLogoMarkBrandingProps
  | TeamLogoMarkLegacyProps;

function resolveLogoProps(props: TeamLogoMarkProps): TeamLogoProps & {
  logoId: TeamLogoId;
} {
  if (props.branding) {
    const logoId = isTeamLogoId(props.branding.logoId)
      ? props.branding.logoId
      : ("shield" as TeamLogoId);
    return {
      logoId,
      primaryColor: props.branding.primaryColor,
      secondaryColor: props.branding.secondaryColor,
      accentColor: props.branding.accentColor,
      title: props.title,
      decorative: props.decorative,
    };
  }
  return {
    logoId: props.logoId,
    primaryColor: props.primaryColor,
    secondaryColor: props.secondaryColor,
    accentColor: props.accentColor,
    title: props.title,
    decorative: props.decorative,
  };
}

export function TeamLogoMark(props: TeamLogoMarkProps) {
  const resolved = resolveLogoProps(props);
  const sizeClass = props.size ? SIZE_CLASS[props.size] : undefined;
  const className = [sizeClass, props.className].filter(Boolean).join(" ");
  const markProps = { ...resolved, className: className || undefined };

  const Component = LOGO_COMPONENTS[resolved.logoId];
  if (!Component) {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        `[TeamLogoMark] Unknown logoId "${resolved.logoId}" — falling back to shield.`,
      );
    }
    return <ShieldLogo {...markProps} />;
  }
  return <Component {...markProps} />;
}

export {
  WolfLogo,
  BearLogo,
  EagleLogo,
  LionLogo,
} from "./mascot-logos";
export {
  LightningLogo,
  FlameLogo,
} from "./power-logos";
export {
  CrownLogo,
  ShieldLogo,
  StarLogo,
  MonogramLogo,
} from "./classic-logos";
