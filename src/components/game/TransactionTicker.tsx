"use client";

import { useEffect, useRef, useState } from "react";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import { useOverflowFocusable } from "@/components/ui/focus/use-overflow-focusable";
import { OvrBadge } from "@/components/ui/OvrBadge";
import { cn, focusRingClass } from "@/components/ui/styles";
import { formatMoney } from "@/domain/owner-objective-text";
import type {
  TransactionTickerItem,
  TransactionTickerView,
} from "@/state/transaction-ticker-selectors";

/** Window event carrying a fresh `TransactionTickerView | null`. */
export const TICKER_UPDATE_EVENT = "ballsim:ticker";

export function dispatchTickerUpdate(view: TransactionTickerView | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<TransactionTickerView | null>(TICKER_UPDATE_EVENT, {
      detail: view,
    }),
  );
}

function TickerItemView(props: {
  saveId: string;
  item: TransactionTickerItem;
}) {
  const { item } = props;
  return (
    <li
      className={cn(
        "flex shrink-0 items-center gap-2 px-3 py-1",
        item.isMyTeam && "bg-team/10",
      )}
    >
      {item.isMyTeam ? (
        <span className="rounded-sm border border-team px-1 text-sm font-semibold uppercase text-team-ink">
          Your team
        </span>
      ) : null}
      <span className="flex items-center gap-1">
        {item.teams.map((team) => (
          <span key={team.teamId} className="flex items-center gap-1">
            {team.branding ? (
              <TeamLogoMark size="sm" branding={team.branding} decorative />
            ) : null}
            <span className="font-display text-sm font-bold uppercase">
              {team.abbreviation}
            </span>
          </span>
        ))}
      </span>
      <span className="text-sm text-muted">
        {item.kind === "trade" ? "Trade" : "Signing"}
      </span>
      {item.players.map((player) => (
        <span key={player.playerId} className="flex items-center gap-1">
          <PlayerEntityLink saveId={props.saveId} playerId={player.playerId}>
            {player.name}
          </PlayerEntityLink>
          {player.overall != null ? (
            <OvrBadge overall={player.overall} size="sm" />
          ) : null}
        </span>
      ))}
      {item.kind === "signing" && item.contractValue != null ? (
        <span className="text-sm tabular-nums text-muted">
          {formatMoney(item.contractValue)}
        </span>
      ) : null}
      <span className="sr-only">{item.headline}</span>
    </li>
  );
}

function TickerStrip(props: {
  saveId: string;
  view: TransactionTickerView;
  announcement: string;
}) {
  const { view } = props;
  const ref = useRef<HTMLUListElement>(null);
  useOverflowFocusable(ref);
  const emptyText =
    view.window === "deadline"
      ? "Deadline day: moves will appear here"
      : "No moves yet";
  return (
    <section
      aria-label={view.title}
      className="flex min-w-0 items-stretch gap-3 border-t border-surface-line pt-2"
    >
      <div className="flex shrink-0 flex-col justify-center rounded-sm bg-live px-2 py-0.5 text-surface-deep">
        <span className="font-display text-sm font-bold uppercase leading-none">
          {view.title}
        </span>
        <span className="text-sm leading-tight">{view.status}</span>
      </div>
      {view.summary ? (
        <div className="flex shrink-0 flex-col justify-center rounded-sm border border-surface-line px-2 py-0.5">
          <span className="font-display text-sm font-bold uppercase leading-none">
            Deadline is over: {view.summary.trades}{" "}
            {view.summary.trades === 1 ? "trade" : "trades"}
          </span>
          {view.summary.biggestMove ? (
            <span className="text-sm text-muted">
              Biggest move: {view.summary.biggestMove}
            </span>
          ) : null}
        </div>
      ) : null}
      {view.items.length === 0 ? (
        <p className="flex items-center text-sm text-muted">{emptyText}</p>
      ) : (
        <ul
          ref={ref}
          role="list"
          aria-label={`${view.title} moves`}
          className={cn(
            "relative flex min-w-0 flex-1 items-stretch divide-x divide-surface-line overflow-x-auto rounded-sm [scrollbar-width:none]",
            focusRingClass,
          )}
        >
          {view.items.map((item) => (
            <TickerItemView key={item.id} saveId={props.saveId} item={item} />
          ))}
        </ul>
      )}
      <span aria-live="polite" className="sr-only">
        {props.announcement}
      </span>
    </section>
  );
}

/**
 * Slim "breaking" strip for deadline day and the first days of free agency.
 * Shows the server view, replaced by live `ballsim:ticker` updates until the
 * server view changes (for example after a refresh). Never auto-scrolls.
 */
export function TransactionTicker(props: {
  saveId: string;
  ticker: TransactionTickerView | null;
}) {
  const [seenProp, setSeenProp] = useState(props.ticker);
  const [live, setLive] = useState<TransactionTickerView | null | undefined>(
    undefined,
  );
  const [announcement, setAnnouncement] = useState("");
  if (seenProp !== props.ticker) {
    setSeenProp(props.ticker);
    setLive(undefined);
  }
  const view = live === undefined ? props.ticker : live;
  const countRef = useRef(0);
  useEffect(() => {
    countRef.current = view?.items.length ?? 0;
  }, [view]);

  useEffect(() => {
    const onUpdate = (event: Event) => {
      const next = (event as CustomEvent<TransactionTickerView | null>).detail;
      const grown = (next?.items.length ?? 0) - countRef.current;
      setLive(next ?? null);
      if (grown > 0) {
        setAnnouncement(`${grown} new ${grown === 1 ? "move" : "moves"}`);
      }
    };
    window.addEventListener(TICKER_UPDATE_EVENT, onUpdate);
    return () => window.removeEventListener(TICKER_UPDATE_EVENT, onUpdate);
  }, []);

  if (!view) return null;
  return (
    <TickerStrip
      saveId={props.saveId}
      view={view}
      announcement={announcement}
    />
  );
}
