import Link from "next/link";
import { cn, focusRingClass, slantClass } from "@/components/ui/styles";

export type TabItem = {
  key: string;
  label: string;
  /** Link tab (page sub-navigation). */
  href?: string;
  /** Button tab (in-card switching); requires a client parent. */
  onSelect?: () => void;
  badge?: React.ReactNode;
};

type TabsProps = {
  items: readonly TabItem[];
  activeKey: string;
  "aria-label": string;
  className?: string;
  /** "slant" draws parallelogram slabs in the team colour. */
  variant?: "underline" | "slant";
};

/**
 * The one tab row: underline style, display font, team-ink active bar (or the
 * slanted console style with `variant="slant"`).
 * Use for page sub-navigation (`href`) and in-card tabs (`onSelect`).
 * At most one tab row per page.
 */
export function Tabs(props: TabsProps) {
  const slant = props.variant === "slant";
  return (
    <nav
      aria-label={props["aria-label"]}
      className={cn(
        // overflow-x-auto alone promotes overflow-y to auto, so an underline
        // hanging past the edge showed a vertical scrollbar on desktop.
        "-mx-1 flex overflow-x-auto overflow-y-hidden [scrollbar-width:none]",
        slant ? "gap-2 px-1" : "gap-1 border-b border-surface-line",
        props.className,
      )}
    >
      {props.items.map((item) => {
        const active = item.key === props.activeKey;
        const className = cn(
          "relative inline-flex min-h-11 shrink-0 items-center gap-2 px-3 font-display text-base font-semibold uppercase tracking-wide transition touch-manipulation",
          slant
            ? cn(
                slantClass,
                "px-5",
                active
                  ? "text-on-team [--slant-fill:var(--team-primary)]"
                  : "text-muted hover:text-ink hover:[--slant-fill:var(--surface-high)]",
              )
            : cn(
                "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full",
                active
                  ? "text-ink after:bg-team-ink"
                  : "text-muted after:bg-transparent hover:text-ink",
              ),
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

/** Tabs fixed to the slanted console style. */
export function SlantTabs(props: Omit<TabsProps, "variant">) {
  return <Tabs {...props} variant="slant" />;
}
