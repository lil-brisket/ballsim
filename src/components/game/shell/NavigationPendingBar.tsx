"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/components/ui/styles";

/** Gives up if a navigation never lands, so the bar cannot stay on forever. */
const GIVE_UP_MS = 15_000;

function isNavigationClick(event: MouseEvent, current: string): boolean {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    !(event.target instanceof Element)
  ) {
    return false;
  }
  const link = event.target.closest<HTMLAnchorElement>("a[href]");
  if (!link || link.hasAttribute("download") || link.target === "_blank") {
    return false;
  }
  const url = new URL(link.href, window.location.href);
  return (
    url.origin === window.location.origin &&
    !url.pathname.startsWith("/api/") &&
    `${url.pathname}${url.search}` !== current
  );
}

/**
 * Thin bar along the top of the screen while any clicked link's page is on its
 * way: in-save pages have no loading skeleton, so a slow page still needs to
 * answer the click. It waits 100ms before showing, so a page that is already
 * there never flashes it, and it ends by itself when the URL changes.
 */
export function NavigationPendingBar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const current = search ? `${pathname}?${search}` : pathname;
  const [clickedFrom, setClickedFrom] = useState<string | null>(null);

  useEffect(() => {
    let giveUp: ReturnType<typeof setTimeout> | undefined;
    function onClick(event: MouseEvent) {
      if (!isNavigationClick(event, current)) return;
      setClickedFrom(current);
      clearTimeout(giveUp);
      giveUp = setTimeout(() => setClickedFrom(null), GIVE_UP_MS);
    }
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimeout(giveUp);
    };
  }, [current]);

  return (
    <div
      aria-hidden="true"
      data-testid="navigation-pending-bar"
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 bg-team-ink transition-opacity",
        clickedFrom === current ? "opacity-100 delay-100" : "opacity-0",
      )}
    />
  );
}
