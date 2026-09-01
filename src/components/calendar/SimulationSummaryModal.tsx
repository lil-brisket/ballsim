"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { CalendarPageMediaHighlight } from "@/application/game-service";

export function SimulationSummaryModal(props: {
  open: boolean;
  daysAdvanced: number;
  highlightCount: number;
  returnPath: string;
  recentHighlights: readonly CalendarPageMediaHighlight[];
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(props.open);

  useEffect(() => {
    setVisible(props.open);
  }, [props.open]);

  const grouped = useMemo(() => {
    const byDate = new Map<string, CalendarPageMediaHighlight[]>();
    for (const item of props.recentHighlights) {
      const list = byDate.get(item.date);
      if (list) {
        list.push(item);
      } else {
        byDate.set(item.date, [item]);
      }
    }
    return [...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  }, [props.recentHighlights]);

  function dismiss() {
    setVisible(false);
    const url = new URL(props.returnPath, "http://local.invalid");
    url.searchParams.delete("simSummary");
    url.searchParams.delete("daysAdvanced");
    url.searchParams.delete("highlights");
    const next =
      url.pathname +
      (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "");
    router.replace(next);
  }

  if (!visible) {
    return null;
  }

  const dayLabel =
    props.daysAdvanced === 1
      ? "1 day advanced"
      : `${props.daysAdvanced} days advanced`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="simulation-summary-title"
        className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl"
      >
        <div className="border-b border-zinc-800 px-5 py-4">
          <h3
            id="simulation-summary-title"
            className="text-lg font-medium text-zinc-50"
          >
            Simulation Summary
          </h3>
          <p className="mt-1 text-sm text-zinc-400">
            {dayLabel}
            {props.highlightCount > 0
              ? ` · ${props.highlightCount} highlight${props.highlightCount === 1 ? "" : "s"} recorded`
              : null}
          </p>
        </div>

        <div className="max-h-[55vh] space-y-4 overflow-y-auto px-5 py-4">
          <p className="text-sm text-zinc-300">
            League activity was processed through the selected window — games,
            development, finances, and franchise updates as applicable.
          </p>

          {grouped.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Recent activity
              </p>
              {grouped.map(([date, items]) => (
                <section key={date} className="space-y-1.5">
                  <h4 className="font-mono text-xs text-amber-400/90">{date}</h4>
                  <ul className="space-y-1.5">
                    {items.slice(0, 5).map((item, index) => (
                      <li
                        key={`${item.date}-${item.headline}-${index}`}
                        className="rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2"
                      >
                        <p className="text-sm text-zinc-100">{item.headline}</p>
                        {item.summary ? (
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {item.summary}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              No franchise media highlights were available for this window. The
              league still advanced.
            </p>
          )}
        </div>

        <div className="flex justify-end border-t border-zinc-800 px-5 py-3">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md bg-amber-600 px-4 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-500"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
