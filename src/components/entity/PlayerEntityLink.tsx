"use client";

import Link from "next/link";
import { useEntityDrawer } from "@/components/entity/EntityDrawerProvider";
import { cn, focusRingClass } from "@/components/ui/styles";

const DEFAULT_CLASS = cn(
  "text-amber-400 hover:underline",
  focusRingClass,
);

type PlayerEntityLinkProps = {
  saveId: string;
  playerId: string;
  children: React.ReactNode;
  className?: string;
  /** When false, renders plain text (e.g. player outside profile scope). */
  canOpen?: boolean;
  /** Skip drawer and navigate to the full player page. */
  preferNavigation?: boolean;
  /** Explicit full-page href override. */
  href?: string;
};

/**
 * Player entity control: opens Player Drawer by default.
 * Prefer preferNavigation when a full-page jump is required.
 */
export function PlayerEntityLink({
  saveId,
  playerId,
  children,
  className,
  canOpen = true,
  preferNavigation = false,
  href,
}: PlayerEntityLinkProps) {
  const { openPlayer } = useEntityDrawer();
  const destination =
    href ?? `/dashboard/${saveId}/players/${playerId}`;

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
      onClick={() => openPlayer(playerId)}
    >
      {children}
    </button>
  );
}
