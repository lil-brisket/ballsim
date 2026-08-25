import Link from "next/link";

type GameResultLinkProps = {
  saveId: string;
  gameId: string;
  canOpen: boolean;
  children: React.ReactNode;
  className?: string;
  showHint?: boolean;
};

/**
 * Links a completed current-season result to the box-score page.
 * Renders plain content when the game cannot be opened.
 */
export function GameResultLink({
  saveId,
  gameId,
  canOpen,
  children,
  className,
  showHint = false,
}: GameResultLinkProps) {
  if (!canOpen) {
    return <span className={className}>{children}</span>;
  }
  return (
    <Link
      href={`/dashboard/${saveId}/games/${gameId}`}
      className={
        className ??
        "group text-inherit hover:text-amber-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
      }
    >
      {children}
      {showHint ? (
        <span className="ml-2 text-xs text-zinc-600 group-hover:text-amber-500">
          Box score →
        </span>
      ) : null}
    </Link>
  );
}
