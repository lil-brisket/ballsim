import Link from "next/link";
import type { ReactNode } from "react";
import { cn, focusRingClass } from "@/components/ui/styles";

export function TimelineFeed(props: { children: ReactNode }) {
  return (
    // A labelled section, not role="feed": the feed pattern requires only
    // article children and page-key navigation, which this list does not have.
    <section aria-label="League timeline">{props.children}</section>
  );
}

/** Plain link; the server renders the next page from `?before=`. */
export function TimelineLoadMore(props: { href: string | null }) {
  if (!props.href) return null;
  return (
    <Link
      href={props.href}
      className={cn(
        "flex min-h-11 w-full items-center justify-center rounded-md text-sm text-soft touch-manipulation hover:text-ink active:opacity-80",
        focusRingClass,
      )}
    >
      Load more
    </Link>
  );
}

/** Broadcast-style day label between groups of posts in the feed. */
export function TimelineDayDivider(props: { label: string }) {
  return (
    <div
      role="separator"
      className="border-b border-line pb-2 pt-4 text-sm font-semibold text-soft first:pt-0"
    >
      {props.label}
    </div>
  );
}
