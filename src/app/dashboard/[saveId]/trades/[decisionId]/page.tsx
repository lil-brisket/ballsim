import Link from "next/link";
import { notFound } from "next/navigation";
import {
  acceptOwnerDecisionAction,
  declineOwnerDecisionAction,
} from "@/application/actions";
import { prismaSaveGameStore } from "@/persistence/save-game-repository";
import { PLAYER_POSITIONS } from "@/domain/entities/player";
import { evaluateTrade } from "@/systems/trades/asset-valuation/complete-trade-evaluation";
import {
  projectDraftPick,
  tierDisplayLabel,
} from "@/systems/trades/asset-valuation/pick-projection";
import { motivationDisplayLabel } from "@/systems/trades/cpu-trade-generator";
import { getContractSalaryForYear } from "@/domain/entities/contract";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import type { GameState } from "@/state/game-state";
import type { TeamId } from "@/domain/ids";

type PageProps = {
  params: Promise<{ saveId: string; decisionId: string }>;
};

export default async function TradeReviewPage(props: PageProps) {
  const { saveId, decisionId } = await props.params;
  const loaded = await prismaSaveGameStore.load(saveId);
  if (!loaded) notFound();
  const state = loaded.state;
  const pending = state.user.pendingOwnerDecisions.find(
    (d) => d.id === decisionId,
  );
  if (!pending || pending.type !== "trade_offer") notFound();

  const proposal =
    pending.payload.currentProposal ?? pending.payload.proposal;
  const userTeamId = pending.payload.userTeamId;
  const offeringTeamId = pending.payload.offeringTeamId;
  const evaluation = evaluateTrade(state, userTeamId, proposal);
  const offeringTeam = state.world.teams[offeringTeamId];
  const receivingTeam = state.world.teams[userTeamId];
  const motivation = pending.payload.motivation;
  const beforeAfter = rosterDepthBeforeAfter(state, userTeamId, proposal);
  const returnPath = `/dashboard/${saveId}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 text-sm text-zinc-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Trade review
          </p>
          <h1 className="text-2xl font-semibold text-zinc-50">
            {offeringTeam
              ? `${offeringTeam.city} ${offeringTeam.name}`
              : offeringTeamId}{" "}
            →{" "}
            {receivingTeam
              ? `${receivingTeam.city} ${receivingTeam.name}`
              : userTeamId}
          </h1>
        </div>
        <Link
          href={returnPath}
          className="rounded-md border border-zinc-600 px-3 py-1.5 text-zinc-200 hover:border-zinc-400"
        >
          Back to dashboard
        </Link>
      </div>

      {motivation ? (
        <p className="rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-zinc-300">
          Why they&apos;re calling: {motivationDisplayLabel(motivation)}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <AssetColumn
          title="You receive"
          state={state}
          side={
            proposal.sideA.teamId === offeringTeamId
              ? proposal.sideA
              : proposal.sideB
          }
        />
        <AssetColumn
          title="You send"
          state={state}
          side={
            proposal.sideA.teamId === userTeamId
              ? proposal.sideA
              : proposal.sideB
          }
        />
      </div>

      <section className="rounded-md border border-zinc-700 bg-zinc-950/50 px-4 py-3">
        <h2 className="text-base font-medium text-zinc-50">Evaluation</h2>
        <p className="mt-1 text-zinc-300">
          {evaluation.recommendation === "favor_receive"
            ? "Favors you"
            : evaluation.recommendation === "favor_send"
              ? "Favors them"
              : "Roughly even"}{" "}
          · Net value {evaluation.valueDifference.toFixed(1)}
        </p>
        <ul className="mt-2 list-inside list-disc text-zinc-400">
          {evaluation.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-zinc-400">
          <div>Roster fit {(evaluation.rosterFit * 100).toFixed(0)}%</div>
          <div>
            Strategic fit {(evaluation.strategicFit * 100).toFixed(0)}%
          </div>
          <div>
            Financial {(evaluation.financialImpact * 100).toFixed(0)}%
          </div>
        </div>
      </section>

      <section className="rounded-md border border-zinc-700 bg-zinc-950/50 px-4 py-3">
        <h2 className="text-base font-medium text-zinc-50">Roster impact</h2>
        <table className="mt-2 w-full text-left text-xs">
          <thead className="text-zinc-500">
            <tr>
              <th className="py-1">Position</th>
              <th>Before</th>
              <th>After</th>
            </tr>
          </thead>
          <tbody>
            {beforeAfter.map((row) => (
              <tr key={row.position} className="border-t border-zinc-800">
                <td className="py-1">{row.position}</td>
                <td>{row.before}</td>
                <td>{row.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {beforeAfter.some((r) => r.after > r.before) ? (
          <p className="mt-2 text-xs text-emerald-300/90">
            Incoming depth may push a player into the rotation.
          </p>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-2">
        <form action={acceptOwnerDecisionAction}>
          <input type="hidden" name="saveId" value={saveId} />
          <input type="hidden" name="decisionId" value={decisionId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <button
            type="submit"
            className="rounded-md bg-emerald-700 px-3 py-1.5 font-medium text-zinc-50 hover:bg-emerald-600"
          >
            Accept
          </button>
        </form>
        <Link
          href={`/dashboard/${saveId}/trades/${decisionId}/negotiate`}
          className="rounded-md border border-zinc-500 px-3 py-1.5 text-zinc-100 hover:border-zinc-300"
        >
          Negotiate
        </Link>
        <form action={declineOwnerDecisionAction}>
          <input type="hidden" name="saveId" value={saveId} />
          <input type="hidden" name="decisionId" value={decisionId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <button
            type="submit"
            className="rounded-md border border-zinc-600 px-3 py-1.5 text-zinc-200 hover:border-zinc-400"
          >
            Decline
          </button>
        </form>
      </div>
    </div>
  );
}

function AssetColumn(props: {
  title: string;
  state: GameState;
  side: TradeProposal["sideA"];
}) {
  const year = props.state.competition.season.year;
  return (
    <div className="rounded-md border border-zinc-700 bg-zinc-950/50 px-4 py-3">
      <h2 className="text-base font-medium text-zinc-50">{props.title}</h2>
      <ul className="mt-2 space-y-3">
        {props.side.playerIds.map((playerId) => {
          const player = props.state.world.players[playerId];
          if (!player) {
            return <li key={playerId}>Unknown player</li>;
          }
          const ovr = calculatePlayerOverall(player.position, player.attributes);
          const contract = player.contractId
            ? props.state.business.contracts[player.contractId]
            : undefined;
          const salary = contract
            ? getContractSalaryForYear(contract, year)
            : undefined;
          return (
            <li key={playerId} className="rounded border border-zinc-800 px-2 py-2">
              <Link
                href={`/dashboard/${props.state.meta.saveId}/players/${playerId}`}
                className="font-medium text-amber-100 hover:underline"
              >
                {player.firstName} {player.lastName}
              </Link>
              <p className="text-xs text-zinc-400">
                {player.position} · OVR {ovr} · Age {player.age}
                {salary !== undefined
                  ? ` · $${(salary / 1_000_000).toFixed(1)}M`
                  : ""}
              </p>
            </li>
          );
        })}
        {props.side.draftPickIds.map((pickId) => {
          const pick = props.state.world.draftPicks[pickId];
          if (!pick) return <li key={pickId}>Unknown pick</li>;
          const projection = projectDraftPick(props.state, pick);
          return (
            <li key={pickId} className="rounded border border-zinc-800 px-2 py-2">
              <p className="font-medium text-zinc-100">
                {pick.seasonYear} Round {pick.round}
              </p>
              <p className="text-xs text-zinc-400">
                {tierDisplayLabel(projection.tier)} · ~#
                {projection.projectedOverallPick} (range #
                {projection.rangeLow}–#{projection.rangeHigh},{" "}
                {projection.confidence} confidence)
              </p>
            </li>
          );
        })}
        {props.side.playerIds.length === 0 &&
        props.side.draftPickIds.length === 0 ? (
          <li className="text-zinc-500">Nothing</li>
        ) : null}
      </ul>
    </div>
  );
}

function rosterDepthBeforeAfter(
  state: GameState,
  teamId: TeamId,
  proposal: TradeProposal,
): Array<{ position: string; before: number; after: number }> {
  const team = state.world.teams[teamId];
  if (!team) return [];
  const outgoing =
    proposal.sideA.teamId === teamId
      ? proposal.sideA.playerIds
      : proposal.sideB.playerIds;
  const incoming =
    proposal.sideA.teamId === teamId
      ? proposal.sideB.playerIds
      : proposal.sideA.playerIds;
  const outSet = new Set(outgoing);

  return PLAYER_POSITIONS.map((position) => {
    const before = team.roster.filter((id) => {
      const p = state.world.players[id];
      return p?.position === position;
    }).length;
    let after = before;
    for (const id of outgoing) {
      if (state.world.players[id]?.position === position) after -= 1;
    }
    for (const id of incoming) {
      if (state.world.players[id]?.position === position) after += 1;
    }
    void outSet;
    return { position, before, after };
  });
}
