"use client";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { buttonClass } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useState } from "react";
import {
  declineOwnerDecisionAction,
  proposePlayerTradeAction,
} from "@/application/actions";
import { OvrBadge } from "@/components/ui/OvrBadge";

export type TradeBuilderPlayer = {
  id: string;
  name: string;
  position: string;
  overall: number;
  age: number;
};

export type TradeBuilderPick = {
  id: string;
  label: string;
};

export type TradeBuilderTeam = {
  id: string;
  /** "{Player} — {City Name}" */
  label: string;
  players: TradeBuilderPlayer[];
  picks: TradeBuilderPick[];
};

export type SentOffer = {
  id: string;
  toLabel: string;
  sends: string[];
  receives: string[];
};

type Props = {
  saveId: string;
  returnPath: string;
  myTeamId: string;
  myTeam: Omit<TradeBuilderTeam, "label">;
  targets: TradeBuilderTeam[];
  sentOffers: SentOffer[];
  error?: string;
};

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function PlayerTradeBuilder(props: Props) {
  const { saveId, returnPath, myTeamId, myTeam, targets, sentOffers, error } =
    props;
  const [targetId, setTargetId] = useState(targets[0]?.id ?? "");
  const [sendPlayers, setSendPlayers] = useState<string[]>([]);
  const [sendPicks, setSendPicks] = useState<string[]>([]);
  const [askPlayers, setAskPlayers] = useState<string[]>([]);
  const [askPicks, setAskPicks] = useState<string[]>([]);

  const target = targets.find((t) => t.id === targetId);
  const canSubmit =
    target !== undefined &&
    sendPlayers.length + sendPicks.length > 0 &&
    askPlayers.length + askPicks.length > 0;

  const proposalJson = JSON.stringify({
    sideA: {
      teamId: myTeamId,
      playerIds: sendPlayers,
      draftPickIds: sendPicks,
    },
    sideB: { teamId: targetId, playerIds: askPlayers, draftPickIds: askPicks },
  });

  function changeTarget(id: string) {
    setTargetId(id);
    setAskPlayers([]);
    setAskPicks([]);
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-red-700 bg-red-950/40 px-3 py-2 text-red-200"
        >
          {error}
        </p>
      ) : null}

      <form action={proposePlayerTradeAction} className="space-y-4">
        <input type="hidden" name="saveId" value={saveId} />
        <input type="hidden" name="returnPath" value={returnPath} />
        <input type="hidden" name="proposalJson" value={proposalJson} />

        <label className="flex flex-col gap-1 text-soft">
          Trade with
          <Select
            value={targetId}
            onChange={(e) => changeTarget(e.target.value)}
            wrapperClassName="w-full"
          >
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <AssetColumn
            title="You send"
            verb="Send"
            players={myTeam.players}
            picks={myTeam.picks}
            selectedPlayers={sendPlayers}
            selectedPicks={sendPicks}
            onPlayer={(id) => setSendPlayers((l) => toggle(l, id))}
            onPick={(id) => setSendPicks((l) => toggle(l, id))}
          />
          <AssetColumn
            title="You receive"
            verb="Ask for"
            players={target?.players ?? []}
            picks={target?.picks ?? []}
            selectedPlayers={askPlayers}
            selectedPicks={askPicks}
            onPlayer={(id) => setAskPlayers((l) => toggle(l, id))}
            onPick={(id) => setAskPicks((l) => toggle(l, id))}
          />
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className={buttonClass({ variant: "primary" })}
        >
          Propose trade
        </button>
      </form>

      <section aria-labelledby="sent-offers-heading" className="space-y-2">
        <SectionHeading id="sent-offers-heading" title="Sent offers" />
        {sentOffers.length === 0 ? (
          <p className="text-faint">No offers waiting on another player.</p>
        ) : (
          <ul className="space-y-2">
            {sentOffers.map((offer) => (
              <li
                key={offer.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line-strong px-3 py-2"
              >
                <div>
                  <p className="text-ink">To {offer.toLabel}</p>
                  <p className="text-muted">
                    You send: {offer.sends.join(", ") || "nothing"}
                  </p>
                  <p className="text-muted">
                    You receive: {offer.receives.join(", ") || "nothing"}
                  </p>
                </div>
                <form action={declineOwnerDecisionAction}>
                  <input type="hidden" name="saveId" value={saveId} />
                  <input type="hidden" name="decisionId" value={offer.id} />
                  <input type="hidden" name="returnPath" value={returnPath} />
                  <button
                    type="submit"
                    className="rounded-md border border-disabled px-3 py-1.5 hover:border-muted"
                  >
                    Withdraw
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AssetColumn(props: {
  title: string;
  verb: "Send" | "Ask for";
  players: TradeBuilderPlayer[];
  picks: TradeBuilderPick[];
  selectedPlayers: string[];
  selectedPicks: string[];
  onPlayer: (id: string) => void;
  onPick: (id: string) => void;
}) {
  return (
    <fieldset className="rounded-md border border-line-strong px-4 py-3">
      <legend className="px-1 text-ink">{props.title}</legend>
      <div className="mt-2 space-y-1">
        {props.players.map((p) => (
          <label key={p.id} className="flex items-center gap-2 text-soft">
            <input
              type="checkbox"
              aria-label={`${props.verb} ${p.name}`}
              checked={props.selectedPlayers.includes(p.id)}
              onChange={() => props.onPlayer(p.id)}
            />
            <span className="flex items-center gap-1.5">
              {p.name} ({p.position})
              <OvrBadge overall={p.overall} size="sm" />
              <span>· Age {p.age}</span>
            </span>
          </label>
        ))}
        {props.picks.map((k) => (
          <label key={k.id} className="flex items-center gap-2 text-soft">
            <input
              type="checkbox"
              aria-label={`${props.verb} ${k.label}`}
              checked={props.selectedPicks.includes(k.id)}
              onChange={() => props.onPick(k.id)}
            />
            <span>{k.label}</span>
          </label>
        ))}
        {props.players.length === 0 && props.picks.length === 0 ? (
          <p className="text-faint">No tradable assets</p>
        ) : null}
      </div>
    </fieldset>
  );
}
