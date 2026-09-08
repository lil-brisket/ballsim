"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { CalendarPageMediaHighlight } from "@/application/game-service";

export function SimulationSummaryModal(props: {
  open: boolean;
  daysAdvanced: number;
  highlightCount: number;
  returnPath: string;
  recentHighlights: readonly CalendarPageMediaHighlight[];
  teamLabel?: string | null;
  record?: { wins: number; losses: number; gamesPlayed: number } | null;
  teamEvents?: readonly { date: string; headline: string }[];
  leagueEvents?: readonly { date: string; headline: string }[];
  injuryNotes?: readonly string[];
  transactionCount?: number;
  fromDate?: string | null;
  toDate?: string | null;
  attentionItems?: readonly {
    id: string;
    title: string;
    href?: string;
  }[];
  saveId?: string;
}) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const visible = props.open && !dismissed;

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
    setDismissed(true);
    const url = new URL(props.returnPath, "http://local.invalid");
    url.searchParams.delete("simSummary");
    url.searchParams.delete("daysAdvanced");
    url.searchParams.delete("highlights");
    url.searchParams.delete("fromDate");
    const next =
      url.pathname +
      (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "");
    router.replace(next);
  }

  if (!visible) {
    return null;
  }

  const rangeLabel =
    props.fromDate && props.toDate
      ? `${props.fromDate} → ${props.toDate}`
      : props.daysAdvanced === 1
        ? "1 day advanced"
        : `${props.daysAdvanced} days advanced`;

  const attentionFromInjuries =
    props.injuryNotes?.map((note, index) => ({
      id: `injury-${index}`,
      title: note,
      href: props.saveId
        ? `/dashboard/${props.saveId}/roster/injuries`
        : undefined,
    })) ?? [];

  const attention = [
    ...(props.attentionItems ?? []),
    ...attentionFromInjuries,
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="simulation-summary-title"
        className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl"
      >
        <div className="border-b border-zinc-800 px-5 py-4">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-amber-500">
            Simulation Complete
          </p>
          <h3
            id="simulation-summary-title"
            className="mt-1 text-lg font-medium text-zinc-50"
          >
            {rangeLabel}
          </h3>
          {props.highlightCount > 0 ? (
            <p className="mt-1 text-sm text-zinc-400">
              {props.highlightCount} highlight
              {props.highlightCount === 1 ? "" : "s"} recorded
            </p>
          ) : null}
        </div>

        <div className="max-h-[55vh] space-y-4 overflow-y-auto px-5 py-4">
          {props.teamLabel || props.record ? (
            <section className="space-y-2 rounded-md border border-zinc-800 bg-zinc-950/40 px-3 py-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Your Team{props.teamLabel ? ` — ${props.teamLabel}` : ""}
              </p>
              {props.record ? (
                <ul className="space-y-1 text-sm text-zinc-200">
                  <li>
                    ✓ {props.record.gamesPlayed} game
                    {props.record.gamesPlayed === 1 ? "" : "s"}
                  </li>
                  {props.record.wins > 0 ? (
                    <li className="text-emerald-400">
                      ✓ {props.record.wins} win
                      {props.record.wins === 1 ? "" : "s"}
                    </li>
                  ) : null}
                  {props.record.losses > 0 ? (
                    <li className="text-rose-400">
                      ✗ {props.record.losses} loss
                      {props.record.losses === 1 ? "" : "es"}
                    </li>
                  ) : null}
                </ul>
              ) : null}
              {typeof props.transactionCount === "number" &&
              props.transactionCount > 0 ? (
                <p className="text-xs text-zinc-400">
                  {props.transactionCount} transaction
                  {props.transactionCount === 1 ? "" : "s"}
                </p>
              ) : null}
            </section>
          ) : null}

          {(props.leagueEvents && props.leagueEvents.length > 0) ||
          (typeof props.transactionCount === "number" &&
            props.transactionCount > 0) ? (
            <section className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                League
              </p>
              <ul className="space-y-1.5">
                {props.leagueEvents?.slice(0, 5).map((event) => (
                  <li
                    key={`${event.date}-${event.headline}`}
                    className="rounded-md border border-zinc-800 px-3 py-2 text-sm text-zinc-300"
                  >
                    <span className="font-mono text-xs text-zinc-500">
                      {event.date}
                    </span>
                    <p>{event.headline}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {attention.length > 0 ? (
            <section className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-amber-500">
                Attention
              </p>
              <ul className="space-y-1.5">
                {attention.slice(0, 6).map((item) => (
                  <li
                    key={item.id}
                    className="rounded-md border border-amber-800/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-100"
                  >
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="hover:text-amber-300"
                      >
                        {item.title}
                      </Link>
                    ) : (
                      item.title
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {props.teamEvents && props.teamEvents.length > 0 ? (
            <section className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Team events
              </p>
              <ul className="space-y-1.5">
                {props.teamEvents.map((event) => (
                  <li
                    key={`${event.date}-${event.headline}`}
                    className="rounded-md border border-zinc-800 px-3 py-2 text-sm text-zinc-100"
                  >
                    <span className="font-mono text-xs text-amber-400/80">
                      {event.date}
                    </span>
                    <p>{event.headline}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {grouped.length > 0 ? (
            <div className="space-y-3 opacity-80">
              <p className="text-xs uppercase tracking-wide text-zinc-600">
                Media highlights
              </p>
              {grouped.map(([date, items]) => (
                <section key={date} className="space-y-1.5">
                  <h4 className="font-mono text-xs text-zinc-500">{date}</h4>
                  <ul className="space-y-1.5">
                    {items.slice(0, 3).map((item, index) => (
                      <li
                        key={`${item.date}-${item.headline}-${index}`}
                        className="rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2"
                      >
                        <p className="text-sm text-zinc-200">{item.headline}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : null}
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
