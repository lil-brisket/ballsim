import type { TeamLogoId } from "@/data/team-branding/logo-catalog";
import type { TeamLogoProps } from "./LogoFrame";
import { LOGO_COMPONENTS, ShieldLogo } from "./logo-registry";

export type { TeamLogoProps } from "./LogoFrame";

export function TeamLogoMark(
  props: TeamLogoProps & { logoId: TeamLogoId },
) {
  const Component = LOGO_COMPONENTS[props.logoId];
  if (!Component) {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        `[TeamLogoMark] Unknown logoId "${props.logoId}" — falling back to shield.`,
      );
    }
    return <ShieldLogo {...props} />;
  }
  return <Component {...props} />;
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
