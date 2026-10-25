import type { Metadata } from "next";
import { canTradeDraftPick } from "@/systems/league-rules";
import { buttonClass } from "@/components/ui/Button";
import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { notFound } from "next/navigation";
import { submitTradeCounterofferAction } from "@/application/actions";
import { getRequestSaveStore } from "@/application/request-save-store";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import { asDraftPickId, asPlayerId, asTeamId } from "@/domain/ids";

export const metadata: Metadata = { title: "Negotiate Trade" };

type PageProps = {
  params: Promise<{ saveId: string; decisionId: string }>;
  searchParams: Promise<{ resumeTo?: string }>;
};

/**
 * Minimal negotiate editor — counter by selecting players/picks you send.
 */
export default async function TradeNegotiatePage(props: PageProps) {
  const { saveId, decisionId } = await props.params;
  const { resumeTo } = await props.searchParams;
  const loaded = await getRequestSaveStore().load(saveId);
  if (!loaded) notFound();
  const state = loaded.state;
  const pending = state.user.pendingOwnerDecisions.find(
    (d) => d.id === decisionId,
  );
  if (!pending || pending.type !== "trade_offer") notFound();

  const proposal = pending.payload.currentProposal ?? pending.payload.proposal;
  const userTeamId = pending.payload.userTeamId;
  const offeringTeamId = pending.payload.offeringTeamId;
  const userTeam = state.world.teams[userTeamId];
  const offeringTeam = state.world.teams[offeringTeamId];
  if (!userTeam || !offeringTeam) notFound();

  const cpuSide =
    proposal.sideA.teamId === offeringTeamId ? proposal.sideA : proposal.sideB;
  const userSide =
    proposal.sideA.teamId === userTeamId ? proposal.sideA : proposal.sideB;

  const userPlayers = userTeam.roster
    .map((id) => state.world.players[id])
    .filter((p) => p !== undefined);
  const userPicks = Object.values(state.world.draftPicks).filter(
    (pick) =>
      pick.ownerTeamId === userTeamId &&
      canTradeDraftPick(state, pick.id).allowed,
  );

  const returnPath = resumeTo
    ? `/dashboard/${saveId}/calendar?resumeTo=${encodeURIComponent(resumeTo)}`
    : `/dashboard/${saveId}/trades/${decisionId}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 text-sm text-zinc-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading as="h1" size="lg" title="Negotiate trade" />
        <Link href={returnPath} className={buttonClass({ variant: "quiet" })}>
          Back to review
        </Link>
      </div>

      <p className="text-zinc-400">
        Adjust what you send. The CPU package stays as originally offered unless
        they counter.
      </p>

      <div className="rounded-md border border-zinc-700 bg-zinc-950/50 px-4 py-3">
        <SectionHeading title="They offer (unchanged)" />
        <ul className="mt-2 list-inside list-disc text-zinc-300">
          {cpuSide.playerIds.map((id) => {
            const p = state.world.players[id];
            return <li key={id}>{p ? `${p.firstName} ${p.lastName}` : id}</li>;
          })}
          {cpuSide.draftPickIds.map((id) => {
            const pick = state.world.draftPicks[id];
            return (
              <li key={id}>
                {pick ? `${pick.seasonYear} R${pick.round}` : id}
              </li>
            );
          })}
        </ul>
      </div>

      <form action={submitTradeCounterofferAction} className="space-y-4">
        <input type="hidden" name="saveId" value={saveId} />
        <input type="hidden" name="decisionId" value={decisionId} />
        <input type="hidden" name="returnPath" value={returnPath} />
        {resumeTo ? (
          <input type="hidden" name="resumeTo" value={resumeTo} />
        ) : null}
        <input type="hidden" name="offeringTeamId" value={offeringTeamId} />
        <input type="hidden" name="userTeamId" value={userTeamId} />
        {cpuSide.playerIds.map((id) => (
          <input
            key={`cpu-p-${id}`}
            type="hidden"
            name="cpuPlayerIds"
            value={id}
          />
        ))}
        {cpuSide.draftPickIds.map((id) => (
          <input
            key={`cpu-k-${id}`}
            type="hidden"
            name="cpuPickIds"
            value={id}
          />
        ))}

        <fieldset className="rounded-md border border-zinc-700 px-4 py-3">
          <legend className="px-1 text-zinc-50">Players you send</legend>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            {userPlayers.map((player) => (
              <label
                key={player.id}
                className="flex items-center gap-2 text-zinc-300"
              >
                <input
                  type="checkbox"
                  name="userPlayerIds"
                  value={player.id}
                  defaultChecked={userSide.playerIds.includes(player.id)}
                />
                {player.firstName} {player.lastName} ({player.position})
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="rounded-md border border-zinc-700 px-4 py-3">
          <legend className="px-1 text-zinc-50">Picks you send</legend>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            {userPicks.map((pick) => (
              <label
                key={pick.id}
                className="flex items-center gap-2 text-zinc-300"
              >
                <input
                  type="checkbox"
                  name="userPickIds"
                  value={pick.id}
                  defaultChecked={userSide.draftPickIds.includes(pick.id)}
                />
                {pick.seasonYear} Round {pick.round}
              </label>
            ))}
            {userPicks.length === 0 ? (
              <p className="text-zinc-500">No available picks</p>
            ) : null}
          </div>
        </fieldset>

        <button type="submit" className={buttonClass({ variant: "primary" })}>
          Send counteroffer
        </button>
      </form>
    </div>
  );
}

/** Helper exported for tests — build counter proposal from form parts. */
export function buildCounterProposalFromParts(input: {
  offeringTeamId: string;
  userTeamId: string;
  cpuPlayerIds: string[];
  cpuPickIds: string[];
  userPlayerIds: string[];
  userPickIds: string[];
}): TradeProposal {
  return {
    sideA: {
      teamId: asTeamId(input.offeringTeamId),
      playerIds: input.cpuPlayerIds.map(asPlayerId),
      draftPickIds: input.cpuPickIds.map(asDraftPickId),
    },
    sideB: {
      teamId: asTeamId(input.userTeamId),
      playerIds: input.userPlayerIds.map(asPlayerId),
      draftPickIds: input.userPickIds.map(asDraftPickId),
    },
  };
}
