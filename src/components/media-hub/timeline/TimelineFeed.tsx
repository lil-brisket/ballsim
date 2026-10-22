import Link from "next/link";
import type { ReactNode } from "react";
import { cn, focusRingClass } from "@/components/ui/styles";

export function TimelineFeed(props: { children: ReactNode }) {
  return (
    <div role="feed" aria-busy="false" aria-label="League timeline">
      {props.children}
    </div>
  );
}

/** Plain link; the server renders the next page from `?before=`. */
export function TimelineLoadMore(props: { href: string | null }) {
  if (!props.href) return null;
  return (
    <Link
      href={props.href}
      className={cn(
        "flex min-h-11 w-full items-center justify-center rounded-md text-sm text-zinc-300 touch-manipulation hover:text-zinc-100 active:opacity-80",
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
      className="border-b border-zinc-800 pb-2 pt-4 text-sm font-semibold text-zinc-300 first:pt-0"
    >
      {props.label}
    </div>
  );
}
