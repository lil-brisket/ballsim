import type { ReactNode } from "react";

export type TeamLogoProps = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  className?: string;
  title?: string;
  /** When true, logo is decorative (aria-hidden); team name text should label. */
  decorative?: boolean;
};

export function LogoFrame(props: TeamLogoProps & { children: ReactNode }) {
  if (props.decorative) {
    return (
      <svg
        viewBox="0 0 64 64"
        aria-hidden="true"
        focusable="false"
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
