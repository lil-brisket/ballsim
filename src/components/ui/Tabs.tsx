import Link from "next/link";
import { cn, focusRingClass } from "@/components/ui/styles";

export type TabItem = {
  key: string;
  label: string;
  /** Link tab (page sub-navigation). */
  href?: string;
  /** Button tab (in-card switching); requires a client parent. */
  onSelect?: () => void;
  badge?: React.ReactNode;
};

/**
 * The one tab row: underline style, display font, team-ink active bar.
 * Use for page sub-navigation (`href`) and in-card tabs (`onSelect`).
 * At most one tab row per page.
 */
export function Tabs(props: {
  items: readonly TabItem[];
  activeKey: string;
  "aria-label": string;
  className?: string;
}) {
  return (
    <nav
      aria-label={props["aria-label"]}
      className={cn(
        "-mx-1 flex gap-1 overflow-x-auto border-b border-surface-line",
        props.className,
      )}
    >
      {props.items.map((item) => {
        const active = item.key === props.activeKey;
        const className = cn(
          "relative inline-flex min-h-11 shrink-0 items-center gap-2 px-3 font-display text-base font-semibold uppercase tracking-wide transition touch-manipulation",
          "after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full",
          active
            ? "text-zinc-50 after:bg-team-ink"
            : "text-zinc-400 after:bg-transparent hover:text-zinc-100",
          focusRingClass,
        );
        const content = (
          <>
            {item.label}
            {item.badge}
          </>
        );
        if (item.href) {
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={className}
            >
              {content}
            </Link>
          );
        }
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={active}
            onClick={item.onSelect}
            className={className}
          >
            {content}
          </button>
        );
      })}
    </nav>
  );
}
