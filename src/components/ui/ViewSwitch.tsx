"use client";

import Link from "next/link";
import { cn, focusRingClass } from "@/components/ui/styles";

export type ViewSwitchItem = {
  key: string;
  label: string;
  /** URL view (preferred: deep-linkable). */
  href?: string;
  /** Client-state view, for switches that cannot live in the URL. */
  onSelect?: () => void;
  /** Small trailing count, e.g. unread items. */
  badge?: React.ReactNode;
};

/**
 * Segmented switch between views of one sub-tab (e.g. Schedule as a calendar
 * or a list). Not navigation between sections: that is the hub sub-tab row.
 * Link items mark the active view with aria-current; button items (onSelect)
 * with aria-pressed.
 */
export function ViewSwitch(props: {
  items: readonly ViewSwitchItem[];
  activeKey: string;
  "aria-label": string;
  className?: string;
}) {
  const content = props.items.map((item) => {
    const active = item.key === props.activeKey;
    const className = cn(
      "inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-sm font-medium touch-manipulation",
      active ? "bg-surface-high text-ink" : "text-muted hover:text-ink",
      focusRingClass,
    );
    if (item.href !== undefined) {
      return (
        <Link
          key={item.key}
          href={item.href}
          aria-current={active ? "page" : undefined}
          className={className}
        >
          {item.label}
          {item.badge}
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
        {item.label}
        {item.badge}
      </button>
    );
  });
  const frame = cn(
    "inline-flex rounded-lg border border-line bg-surface-deep/60 p-0.5",
    props.className,
  );
  // Links navigate (a nav landmark); buttons switch a view in place (a group).
  return props.items.every((item) => item.href !== undefined) ? (
    <nav aria-label={props["aria-label"]} className={frame}>
      {content}
    </nav>
  ) : (
    <div role="group" aria-label={props["aria-label"]} className={frame}>
      {content}
    </div>
  );
}
