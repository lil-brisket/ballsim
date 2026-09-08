"use client";

import Link from "next/link";
import { useEntityDrawer } from "@/components/entity/EntityDrawerProvider";
import { cn, focusRingClass } from "@/components/ui/styles";

const DEFAULT_CLASS = cn(
  "text-amber-400 hover:underline",
  focusRingClass,
);

type TeamEntityLinkProps = {
  saveId: string;
  teamId: string;
  children: React.ReactNode;
  className?: string;
  /** When false, renders plain text. */
  canOpen?: boolean;
  /** Skip drawer and navigate to the full destination. */
  preferNavigation?: boolean;
  /**
   * Destination when preferNavigation is true, or for drawer "View team".
   * Defaults to league overview when no dedicated team page exists.
   */
  href?: string;
};

/**
 * Team entity control: opens Team Drawer by default.
 * teamId is always used for drawer loading.
 */
export function TeamEntityLink({
  saveId,
  teamId,
  children,
  className,
  canOpen = true,
  preferNavigation = false,
  href,
}: TeamEntityLinkProps) {
  const { openTeam } = useEntityDrawer();
  const destination = href ?? `/dashboard/${saveId}/league`;

  if (!canOpen) {
    return <span className={className}>{children}</span>;
  }

  if (preferNavigation) {
    return (
      <Link href={destination} className={className ?? DEFAULT_CLASS}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className ?? DEFAULT_CLASS}
      onClick={() => openTeam(teamId)}
    >
      {children}
    </button>
  );
}
