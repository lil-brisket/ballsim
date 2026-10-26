import Link from "next/link";
import { cn, focusRingClass } from "@/components/ui/styles";

/**
 * Segmented switch between views of one sub-tab (e.g. Schedule as a calendar
 * or a list). Not navigation between sections: that is the hub sub-tab row.
 */
export function ViewSwitch(props: {
  items: ReadonlyArray<{ key: string; label: string; href: string }>;
  activeKey: string;
  "aria-label": string;
  className?: string;
}) {
  return (
    <nav
      aria-label={props["aria-label"]}
      className={cn(
        "inline-flex rounded-lg border border-line bg-surface-deep/60 p-0.5",
        props.className,
      )}
    >
      {props.items.map((item) => {
        const active = item.key === props.activeKey;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-md px-4 text-sm font-medium touch-manipulation",
              active ? "bg-surface-high text-ink" : "text-muted hover:text-ink",
              focusRingClass,
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
