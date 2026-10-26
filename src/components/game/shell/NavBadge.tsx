import type { OwnerNavBadge } from "@/state/owner-nav-badges";
import { cn } from "@/components/ui/styles";

const KIND_CLASS: Record<OwnerNavBadge["kind"], string> = {
  critical: "bg-loss text-surface-base",
  actionable: "bg-warning text-surface-base",
  unread: "bg-disabled text-ink",
};

/** Count chip on a hub or tab. Decorative: the link's name carries it. */
export function NavBadge(props: { badge?: OwnerNavBadge; className?: string }) {
  const badge = props.badge;
  if (!badge || badge.count <= 0) return null;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex min-w-[1.15rem] items-center justify-center rounded-full px-1.5 font-sans text-xs font-semibold normal-case tabular-nums leading-4 tracking-normal",
        KIND_CLASS[badge.kind],
        props.className,
      )}
    >
      {badge.count > 99 ? "99+" : badge.count}
    </span>
  );
}

/** Screen-reader suffix for a badge, e.g. ", 19 unread". */
export function badgeLabel(badge?: OwnerNavBadge): string {
  return badge && badge.count > 0 ? `, ${badge.count} ${badge.label}` : "";
}
