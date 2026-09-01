import Link from "next/link";

type TeamEntityLinkProps = {
  saveId: string;
  teamId: string;
  children: React.ReactNode;
  className?: string;
  /**
   * Destination when a dedicated team page exists for this context.
   * Defaults to league overview (no per-team public page yet).
   */
  href?: string;
};

/**
 * Links a team name to the best available owner-mode destination.
 * Prefer an explicit href (e.g. `/team` for the active franchise).
 * Falls back to league when no team detail route exists.
 */
export function TeamEntityLink({
  saveId,
  teamId: _teamId,
  children,
  className,
  href,
}: TeamEntityLinkProps) {
  const destination = href ?? `/dashboard/${saveId}/league`;

  return (
    <Link
      href={destination}
      className={
        className ??
        "text-amber-400 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
      }
    >
      {children}
    </Link>
  );
}
