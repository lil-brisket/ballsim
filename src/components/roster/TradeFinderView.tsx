"use client";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { useState, useTransition } from "react";
import { findTradeOffersAction } from "@/application/actions";
import { formatMoney } from "@/components/owner/MoneyDisplay";
import { TradeOfferCard } from "@/components/roster/TradeOfferCard";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn, focusRingClass } from "@/components/ui/styles";
import type { RosterPagePlayerView } from "@/state/roster-page-selectors";
import type {
  TradeAssetView,
  TradeOfferView,
} from "@/state/trade-offer-selectors";
import { TRADE_OFFER_MAX_ASSETS_PER_SIDE } from "@/systems/trades-config";
import { OvrBadge } from "@/components/ui/OvrBadge";

type PickView = Extract<TradeAssetView, { kind: "draftPick" }>;
type Selected = { kind: "player" | "draftPick"; id: string };

const keyOf = (asset: Selected) => `${asset.kind}:${asset.id}`;

const itemClass = (selected: boolean) =>
  cn(
    "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40",
    selected
      ? "border-team-ink bg-surface-high text-ink"
      : "border-line bg-surface-raised/60 text-soft hover:border-disabled",
    focusRingClass,
  );

export function TradeFinderView(props: {
  saveId: string;
  roster: RosterPagePlayerView[];
  picks: PickView[];
  suggestedOutgoingPlayerId: string | null;
}) {
  const { roster, picks } = props;
  const [selected, setSelected] = useState<Selected[]>(() =>
    props.suggestedOutgoingPlayerId &&
    roster.some((p) => p.playerId === props.suggestedOutgoingPlayerId)
      ? [{ kind: "player", id: props.suggestedOutgoingPlayerId }]
      : [],
  );
  const [offers, setOffers] = useState<TradeOfferView[] | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const max = TRADE_OFFER_MAX_ASSETS_PER_SIDE;
  const full = selected.length >= max;
  const isSelected = (asset: Selected) =>
    selected.some((s) => keyOf(s) === keyOf(asset));
  const toggle = (asset: Selected) =>
    setSelected((current) =>
      current.some((s) => keyOf(s) === keyOf(asset))
        ? current.filter((s) => keyOf(s) !== keyOf(asset))
        : current.length >= max
          ? current
          : [...current, asset],
    );

  const sortedPlayers = [...roster].sort((a, b) => b.overall - a.overall);

  const slotLabel = (asset: Selected): string => {
    if (asset.kind === "player") {
      const p = roster.find((r) => r.playerId === asset.id);
      return p ? `${p.firstName} ${p.lastName}` : asset.id;
    }
    const pick = picks.find((r) => r.id === asset.id);
    if (!pick) {
      return asset.id;
    }
    return pick.viaAbbreviation
      ? `${pick.name} via ${pick.viaAbbreviation}`
      : pick.name;
  };

  const find = () => {
    const assets = selected.map((s) => ({ kind: s.kind, id: s.id }));
    setError(null);
    startTransition(async () => {
      const result = await findTradeOffersAction(props.saveId, assets);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOffers(result.offers);
      setIndex(0);
    });
  };

  if (offers !== null) {
    const back = (
      <button
        type="button"
        className={buttonClass({ variant: "secondary" })}
        onClick={() => setOffers(null)}
      >
        Change assets
      </button>
    );
    if (offers.length === 0) {
      return (
        <div className="space-y-4">
          <EmptyState message="No teams are interested in this package. Try different assets." />
          {back}
        </div>
      );
    }
    const active = Math.min(index, offers.length - 1);
    const step = (delta: number) =>
      setIndex((i) => (i + delta + offers.length) % offers.length);
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionHeading
            as="h3"
            size="sm"
            titleClassName="text-base!"
            title={
              <>
                {offers.length} {offers.length === 1 ? "team" : "teams"}{" "}
                interested
              </>
            }
          />
          {back}
        </div>
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label="Interested teams"
        >
          {offers.map((offer, i) => (
            <button
              key={offer.counterpartyTeamId}
              type="button"
              aria-pressed={i === active}
              aria-label={`${offer.counterpartyName}, interest ${Math.round(offer.interest)}`}
              onClick={() => setIndex(i)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs",
                i === active
                  ? "border-team-ink bg-surface-high text-ink"
                  : "border-line text-muted hover:border-disabled",
                focusRingClass,
              )}
            >
              {offer.counterpartyAbbreviation}{" "}
              <span className="tabular-nums text-faint">
                {Math.round(offer.interest)}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className={buttonClass({ variant: "secondary" })}
            onClick={() => step(-1)}
          >
            Previous team
          </button>
          <span className="text-sm tabular-nums text-muted">
            {active + 1} of {offers.length}
          </span>
          <button
            type="button"
            className={buttonClass({ variant: "secondary" })}
            onClick={() => step(1)}
          >
            Next team
          </button>
        </div>
        <TradeOfferCard saveId={props.saveId} offer={offers[active]} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Put up to {max} of your players and draft picks on the table and see
        which teams are interested.
      </p>

      <ul className="grid gap-2 sm:grid-cols-3" aria-label="Selected assets">
        {Array.from({ length: max }, (_, slot) => {
          const asset = selected[slot];
          return (
            <li
              key={slot}
              className="flex min-h-14 items-center justify-between gap-2 rounded-lg border border-dashed border-line-strong px-3 py-2 text-sm"
            >
              {asset ? (
                <>
                  <span className="min-w-0 truncate text-ink">
                    {slotLabel(asset)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${slotLabel(asset)}`}
                    onClick={() => toggle(asset)}
                    className={cn(
                      "shrink-0 text-faint hover:text-rose-400",
                      focusRingClass,
                    )}
                  >
                    ✕
                  </button>
                </>
              ) : (
                <span className="text-faint">Empty slot</span>
              )}
            </li>
          );
        })}
      </ul>

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-label="Players" className="space-y-2">
          <SectionHeading as="h3" size="sm" tone="soft" title="Players" />
          {sortedPlayers.length === 0 ? (
            <EmptyState message="No roster players to trade." />
          ) : (
            <ul className="space-y-1">
              {sortedPlayers.map((player) => {
                const asset: Selected = { kind: "player", id: player.playerId };
                const on = isSelected(asset);
                return (
                  <li key={player.playerId}>
                    <button
                      type="button"
                      aria-pressed={on}
                      disabled={!on && full}
                      onClick={() => toggle(asset)}
                      className={itemClass(on)}
                    >
                      <span className="min-w-0 truncate">
                        {player.firstName} {player.lastName}
                        {player.onTradeBlock ? (
                          <span className="ml-2 rounded bg-surface-high px-1.5 py-0.5 text-xs text-muted">
                            on block
                          </span>
                        ) : null}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 text-xs tabular-nums text-faint">
                        <span>{player.position}</span>
                        <OvrBadge overall={player.overall} size="sm" />
                        <span>
                          Age {player.age}
                          {player.contractSalary !== null
                            ? ` · ${formatMoney(player.contractSalary)}`
                            : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-label="Draft picks" className="space-y-2">
          <SectionHeading as="h3" size="sm" tone="soft" title="Draft picks" />
          {picks.length === 0 ? (
            <p className="text-sm text-faint">
              No tradable picks (picks can be traded up to 2 drafts ahead)
            </p>
          ) : (
            <ul className="space-y-1">
              {picks.map((pick) => {
                const asset: Selected = { kind: "draftPick", id: pick.id };
                const on = isSelected(asset);
                return (
                  <li key={pick.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      disabled={!on && full}
                      onClick={() => toggle(asset)}
                      className={itemClass(on)}
                    >
                      <span>{pick.name}</span>
                      {pick.viaAbbreviation ? (
                        <span className="text-xs text-faint">
                          via {pick.viaAbbreviation}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {pending ? (
        <p className="text-sm text-faint">Searching for offers…</p>
      ) : null}
      {error ? (
        <p className="text-sm text-rose-400" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        className={buttonClass({ variant: "primary" })}
        disabled={selected.length === 0 || pending}
        onClick={find}
      >
        Find offers
      </button>
    </div>
  );
}
