import Link from "next/link";

type PlayerEntityLinkProps = {
  saveId: string;
  playerId: string;
  children: React.ReactNode;
  className?: string;
  /** When false, renders plain text (e.g. player outside owner profile scope). */
  canOpen?: boolean;
};

/**
 * Links a player name to the owner-mode player profile page.
 */
export function PlayerEntityLink({
  saveId,
  playerId,
  children,
  className,
  canOpen = true,
}: PlayerEntityLinkProps) {
  if (!canOpen) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Link
      href={`/dashboard/${saveId}/players/${playerId}`}
      className={
        className ??
        "text-amber-400 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
      }
    >
      {children}
    </Link>
  );
}
