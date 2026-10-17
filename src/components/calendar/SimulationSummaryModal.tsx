"use client";

import { buttonClass } from "@/components/ui/Button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { CalendarPageMediaHighlight } from "@/application/game-service";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ScoreNumeral } from "@/components/ui/ScoreNumeral";
import { focusRingClass } from "@/components/ui/styles";
import { formatGameDate } from "@/presentation/game-date";
import { parseGameResultHeadline } from "@/presentation/game-result-headline";

export function SimulationSummaryModal(props: {
  open: boolean;
  daysAdvanced: number;
  highlightCount: number;
  returnPath: string;
  recentHighlights: readonly CalendarPageMediaHighlight[];
  teamLabel?: string | null;
  record?: { wins: number; losses: number; gamesPlayed: number } | null;
  teamEvents?: readonly { date: string; headline: string; gameId?: string }[];
  teamGames?: readonly { date: string; headline: string; gameId?: string }[];
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
      ? `${formatGameDate(props.fromDate)} → ${formatGameDate(props.toDate)}`
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

  const attention = [...(props.attentionItems ?? []), ...attentionFromInjuries];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Dismiss simulation summary"
        className="absolute inset-0 bg-black/60"
        onClick={dismiss}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="simulation-summary-title"
        className="relative z-10 flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-surface-line bg-surface-arena shadow-arena"
      >
        <div
          className="border-b border-surface-line px-5 py-4"
          style={{
            background:
              "radial-gradient(ellipse 90% 140% at 0% 0%, rgb(var(--team-primary-rgb) / 0.4), transparent 70%)",
          }}
        >
          <SectionHeading
            as="h3"
            id="simulation-summary-title"
            eyebrow="Simulation complete"
            title={rangeLabel}
          />
          {props.highlightCount > 0 ? (
            <p className="mt-1 text-sm text-zinc-300">
              {props.highlightCount} highlight
              {props.highlightCount === 1 ? "" : "s"} recorded
            </p>
          ) : null}
        </div>

        <div className="max-h-[55dvh] min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {props.teamLabel || props.record ? (
            <section className="space-y-3 rounded-xl border border-team-ink/30 bg-team/15 px-4 py-3">
              <p className="text-sm font-semibold text-team-ink">
                Your Team{props.teamLabel ? ` — ${props.teamLabel}` : ""}
              </p>
              {props.record ? (
                <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                  <ScoreNumeral
                    value={props.record.gamesPlayed}
                    label={props.record.gamesPlayed === 1 ? "Game" : "Games"}
                    labelBelow
                    size="lg"
                  />
                  <ScoreNumeral
                    value={props.record.wins}
                    label={props.record.wins === 1 ? "Win" : "Wins"}
                    labelBelow
                    size="lg"
                    tone="win"
                  />
                  <ScoreNumeral
                    value={props.record.losses}
                    label={props.record.losses === 1 ? "Loss" : "Losses"}
                    labelBelow
                    size="lg"
                    tone="loss"
                  />
                </div>
              ) : null}
              {typeof props.transactionCount === "number" &&
              props.transactionCount > 0 ? (
                <p className="text-sm text-zinc-300">
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
              <p className="text-sm font-medium text-zinc-300">League</p>
              <ul className="space-y-1.5">
                {props.leagueEvents?.slice(0, 5).map((event) => (
                  <li
                    key={`${event.date}-${event.headline}`}
                    className="rounded-md border border-surface-line px-3 py-2 text-sm text-zinc-300"
                  >
                    <span className="text-sm text-zinc-400">
                      {formatGameDate(event.date)}
                    </span>
                    <p>{event.headline}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {attention.length > 0 ? (
            <section className="space-y-2">
              <p className="text-sm font-semibold text-warning">Attention</p>
              <ul className="space-y-1.5">
                {attention.slice(0, 6).map((item) => (
                  <li
                    key={item.id}
                    className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-zinc-200"
                  >
                    {item.href ? (
                      <Link href={item.href} className="hover:text-team-ink">
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

          {props.teamGames && props.teamGames.length > 0 ? (
            <section className="space-y-2">
              <p className="text-sm font-medium text-zinc-300">Box scores</p>
              <ul className="space-y-1.5">
                {props.teamGames.map((game) => {
                  const parsed = parseGameResultHeadline(game.headline);
                  const tone =
                    parsed?.result === "W"
                      ? "border-l-win"
                      : parsed?.result === "L"
                        ? "border-l-loss"
                        : "border-l-zinc-500";
                  const scoreTone =
                    parsed?.result === "W"
                      ? "text-win"
                      : parsed?.result === "L"
                        ? "text-loss"
                        : "text-zinc-100";
                  const body = parsed ? (
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-display text-xl font-bold uppercase tracking-wide text-zinc-50">
                        vs {parsed.opponent}
                      </span>
                      <span
                        className={`font-display text-2xl font-extrabold tabular-nums ${scoreTone}`}
                      >
                        {parsed.result} {parsed.teamScore}–
                        {parsed.opponentScore}
                      </span>
                    </span>
                  ) : (
                    game.headline
                  );
                  return (
                    <li
                      key={`${game.date}-${game.gameId ?? game.headline}`}
                      className={`rounded-lg border border-l-4 border-surface-line bg-surface-raised px-3 py-2 text-sm text-zinc-100 ${tone}`}
                    >
                      <span className="text-sm text-zinc-400">
                        {formatGameDate(game.date)}
                      </span>
                      {game.gameId && props.saveId ? (
                        <Link
                          href={`/dashboard/${props.saveId}/games/${game.gameId}`}
                          className={`mt-0.5 block rounded hover:text-team-ink ${focusRingClass}`}
                        >
                          {body}
                        </Link>
                      ) : (
                        <p>{body}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {props.teamEvents && props.teamEvents.length > 0 ? (
            <section className="space-y-2">
              <p className="text-sm font-medium text-zinc-300">Team events</p>
              <ul className="space-y-1.5">
                {props.teamEvents.map((event) => (
                  <li
                    key={`${event.date}-${event.headline}`}
                    className="rounded-md border border-surface-line px-3 py-2 text-sm text-zinc-100"
                  >
                    <span className="text-sm text-team-ink">
                      {formatGameDate(event.date)}
                    </span>
                    <p>{event.headline}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {grouped.length > 0 ? (
            <div className="space-y-3 opacity-80">
              <p className="text-sm font-medium text-zinc-400">
                Media highlights
              </p>
              {grouped.map(([date, items]) => (
                <section key={date} className="space-y-1.5">
                  <h4 className="text-sm text-zinc-400">
                    {formatGameDate(date)}
                  </h4>
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

        <div className="safe-area-bottom flex justify-end border-t border-surface-line px-5 py-3">
          <button
            type="button"
            onClick={dismiss}
            className={buttonClass({ variant: "primary", size: "lg" })}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
