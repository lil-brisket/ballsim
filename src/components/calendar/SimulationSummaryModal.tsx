"use client";

import { buttonClass } from "@/components/ui/Button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { CalendarPageMediaHighlight } from "@/application/game-service";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ScoreNumeral } from "@/components/ui/ScoreNumeral";
import { CountUp, prefersReducedMotion } from "@/components/ui/CountUp";
import { playUiSound } from "@/components/ui/sound/ui-sound";
import { focusRingClass } from "@/components/ui/styles";
import { formatGameDate } from "@/presentation/game-date";
import { parseGameResultHeadline } from "@/presentation/game-result-headline";

function ResultReveal(props: {
  game: { date: string; headline: string; gameId?: string };
  saveId?: string;
}) {
  const parsed = parseGameResultHeadline(props.game.headline);
  if (!parsed) {
    return null;
  }
  const win = parsed.result === "W";
  const loss = parsed.result === "L";
  const tone = win ? "win" : loss ? "loss" : "default";
  const stampClass = win
    ? "border-win text-win"
    : loss
      ? "border-loss text-loss"
      : "border-faint text-soft";
  const content = (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm text-muted">{formatGameDate(props.game.date)}</p>
        <p className="truncate font-display text-xl font-bold uppercase tracking-wide text-ink">
          vs {parsed.opponent}
        </p>
        <div
          className="mt-2 flex items-baseline gap-2"
          data-testid="result-reveal-score"
        >
          <ScoreNumeral
            value={<CountUp value={parsed.teamScore} />}
            size="lg"
            tone={tone}
          />
          <span aria-hidden className="font-display text-3xl text-faint">
            –
          </span>
          <ScoreNumeral
            value={<CountUp value={parsed.opponentScore} />}
            size="lg"
            tone="muted"
          />
        </div>
      </div>
      <span
        className={`result-stamp shrink-0 rounded-md border-4 px-3 py-1 font-display text-4xl font-extrabold uppercase tracking-widest ${stampClass}`}
        aria-label={win ? "Win" : loss ? "Loss" : "Tie"}
      >
        {parsed.result}
      </span>
    </div>
  );
  return (
    <section
      aria-label="Latest result"
      className={`rounded-xl border border-l-4 border-surface-line bg-surface-raised px-4 py-3 ${
        win ? "border-l-win" : loss ? "border-l-loss" : "border-l-faint"
      }`}
    >
      {props.game.gameId && props.saveId ? (
        <Link
          href={`/dashboard/${props.saveId}/games/${props.game.gameId}`}
          className={`block rounded hover:text-team-ink ${focusRingClass}`}
        >
          {content}
        </Link>
      ) : (
        content
      )}
    </section>
  );
}

const SIM_MOMENT_MS = 700;

function subscribeNever(): () => void {
  return () => {};
}

/**
 * Full-screen WIN / LOSS flash when the summary opens on a result. Purely
 * decorative: aria-hidden, no pointer events, and never takes focus. Under
 * reduced motion nothing is drawn (the static stamp in the modal remains).
 * The sting plays once whenever sound is on.
 */
function SimMoment(props: { result: "W" | "L" }) {
  const [done, setDone] = useState(false);
  // Server snapshot is "reduced" so nothing flashes before hydration.
  const reduced = useSyncExternalStore(
    subscribeNever,
    prefersReducedMotion,
    () => true,
  );

  useEffect(() => {
    playUiSound("sting");
    const timer = window.setTimeout(() => setDone(true), SIM_MOMENT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const shown = !reduced && !done;
  if (!shown) return null;
  return (
    <div
      aria-hidden="true"
      data-testid="sim-moment"
      data-tone={props.result === "W" ? "win" : "loss"}
      className="sim-moment"
    >
      <span className="sim-moment__word">
        {props.result === "W" ? "Win" : "Loss"}
      </span>
    </div>
  );
}

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
  /** Media Hub top story from the simulated days. */
  aroundTheLeague?: { authorName: string; text: string; href: string } | null;
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

  const allGames = props.teamGames ?? [];
  const latestGame = allGames.length > 0 ? allGames[allGames.length - 1] : null;
  const revealed =
    latestGame != null && parseGameResultHeadline(latestGame.headline) != null;
  const latestResult = latestGame
    ? parseGameResultHeadline(latestGame.headline)?.result
    : undefined;
  const otherGames = revealed ? allGames.slice(0, -1) : allGames;

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
            <p className="mt-1 text-sm text-soft">
              {props.highlightCount} highlight
              {props.highlightCount === 1 ? "" : "s"} recorded
            </p>
          ) : null}
        </div>

        <div className="max-h-[55dvh] min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {latestGame && parseGameResultHeadline(latestGame.headline) ? (
            <ResultReveal game={latestGame} saveId={props.saveId} />
          ) : null}

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
                <p className="text-sm text-soft">
                  {props.transactionCount} transaction
                  {props.transactionCount === 1 ? "" : "s"}
                </p>
              ) : null}
            </section>
          ) : null}

          {props.aroundTheLeague ? (
            <section className="space-y-2">
              <p className="text-sm font-medium text-soft">Around the league</p>
              <Link
                href={props.aroundTheLeague.href}
                className={`block rounded-md border border-surface-line px-3 py-2 text-sm text-soft hover:border-disabled ${focusRingClass}`}
              >
                <span className="font-semibold text-ink">
                  {props.aroundTheLeague.authorName}
                </span>
                <p className="line-clamp-2">{props.aroundTheLeague.text}</p>
              </Link>
            </section>
          ) : null}

          {(props.leagueEvents && props.leagueEvents.length > 0) ||
          (typeof props.transactionCount === "number" &&
            props.transactionCount > 0) ? (
            <section className="space-y-2">
              <p className="text-sm font-medium text-soft">League</p>
              <ul className="space-y-1.5">
                {props.leagueEvents?.slice(0, 5).map((event) => (
                  <li
                    key={`${event.date}-${event.headline}`}
                    className="rounded-md border border-surface-line px-3 py-2 text-sm text-soft"
                  >
                    <span className="text-sm text-muted">
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
                    className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-ink"
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

          {otherGames.length > 0 ? (
            <section className="space-y-2">
              <p className="text-sm font-medium text-soft">
                {revealed ? "Earlier games" : "Box scores"}
              </p>
              <ul className="space-y-1.5">
                {otherGames.map((game) => {
                  const parsed = parseGameResultHeadline(game.headline);
                  const tone =
                    parsed?.result === "W"
                      ? "border-l-win"
                      : parsed?.result === "L"
                        ? "border-l-loss"
                        : "border-l-faint";
                  const scoreTone =
                    parsed?.result === "W"
                      ? "text-win"
                      : parsed?.result === "L"
                        ? "text-loss"
                        : "text-ink";
                  const body = parsed ? (
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-display text-xl font-bold uppercase tracking-wide text-ink">
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
                      className={`rounded-lg border border-l-4 border-surface-line bg-surface-raised px-3 py-2 text-sm text-ink ${tone}`}
                    >
                      <span className="text-sm text-muted">
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
              <p className="text-sm font-medium text-soft">Team events</p>
              <ul className="space-y-1.5">
                {props.teamEvents.map((event) => (
                  <li
                    key={`${event.date}-${event.headline}`}
                    className="rounded-md border border-surface-line px-3 py-2 text-sm text-ink"
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
              <p className="text-sm font-medium text-muted">Media highlights</p>
              {grouped.map(([date, items]) => (
                <section key={date} className="space-y-1.5">
                  <h4 className="text-sm text-muted">{formatGameDate(date)}</h4>
                  <ul className="space-y-1.5">
                    {items.slice(0, 3).map((item, index) => (
                      <li
                        key={`${item.date}-${item.headline}-${index}`}
                        className="rounded-md border border-line bg-surface-base/50 px-3 py-2"
                      >
                        <p className="text-sm text-ink">{item.headline}</p>
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
      {latestGame && (latestResult === "W" || latestResult === "L") ? (
        <SimMoment
          key={`${latestGame.date}-${latestGame.gameId ?? latestGame.headline}`}
          result={latestResult}
        />
      ) : null}
    </div>
  );
}
