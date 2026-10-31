"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ViewSwitch } from "@/components/ui/ViewSwitch";
import {
  parseProspectView,
  useStoredProspectView,
  type ProspectViewMode,
} from "@/components/draft/prospect-view-preference";

/**
 * Sheet | Cards switch above the prospect pool. Both layouts are built on the
 * server (they hold server-action forms) and this picks one: the `?pool=`
 * link, then the viewer's stored choice, then the sheet. A `?pool=` link is
 * also remembered. resumeTo is kept; a stale error banner is not.
 */
export function ProspectPoolView(props: {
  sheet: ReactNode;
  cards: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlView = parseProspectView(searchParams.get("pool"));
  const [storedView, setStoredView] = useStoredProspectView();
  const view: ProspectViewMode = urlView ?? storedView;

  useEffect(() => {
    if (urlView) setStoredView(urlView);
  }, [urlView, setStoredView]);

  function hrefFor(next: ProspectViewMode): string {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("error");
    params.set("pool", next);
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div className="space-y-3">
      <ViewSwitch
        aria-label="Prospect pool view"
        activeKey={view}
        items={[
          { key: "sheet", label: "Sheet", href: hrefFor("sheet") },
          { key: "cards", label: "Cards", href: hrefFor("cards") },
        ]}
      />
      {view === "sheet" ? props.sheet : props.cards}
    </div>
  );
}
