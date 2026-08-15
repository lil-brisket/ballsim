import Link from "next/link";
import { notFound } from "next/navigation";
import { executeTradeAction } from "@/application/actions";
import { loadOwnerPlayerView } from "@/application/game-service";
import { ConfirmDialog } from "@/components/owner/ConfirmDialog";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { StatusBadge } from "@/components/owner/StatusBadge";

type PlayerPageProps = {
  params: Promise<{ saveId: string; playerId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function PlayerDetailPage({
  params,
  searchParams,
}: PlayerPageProps) {
  const { saveId, playerId } = await params;
  const { error } = await searchParams;
  const view = await loadOwnerPlayerView(saveId, playerId);
  if (!view) {
    notFound();
  }

  const { player, dashboard } = view;
  const returnPath = `/dashboard/${saveId}/players/${playerId}`;
  const canTrade =
    player.onControlledRoster &&
    (dashboard.seasonPhase === "regular" ||
      dashboard.seasonPhase === "preseason");

  return (
    <>
      <PageHeader
        title={`${player.firstName} ${player.lastName}`}
        subtitle={`${player.position} · Age ${player.age} · OVR ${player.overall}`}
        actions={
          <Link
            href={`/dashboard/${saveId}/roster`}
            className="text-sm text-zinc-400 hover:text-amber-400"
          >
            ← Roster
          </Link>
        }
      />
      {error ? <ErrorState message={error} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Team" value={player.teamName ?? "Free agent"} />
        <Info label="Nationality" value={player.nationality} />
        <Info label="Archetype" value={player.archetype} />
        <Info
          label="Physical"
          value={`${player.heightInches}" / ${player.weightPounds} lbs`}
        />
        <Info label="Potential" value={String(player.potentialOverall)} />
        <Info label="Development" value={player.developmentStage} />
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-xs text-zinc-500">Injury</p>
          <div className="mt-2">
            <StatusBadge label={player.injuryKind} tone={player.injuryKind} />
          </div>
        </div>
      </div>

      <Section title="Contract">
        {player.contract ? (
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-800 px-4 py-3 text-sm">
            <MoneyDisplay amount={player.contract.salary ?? 0} />
            <span className="text-zinc-400">
              {player.contract.startYear}–{player.contract.endYear} (
              {player.contract.yearsRemaining}y)
            </span>
            <StatusBadge label={player.contract.status} />
            <Link
              href={`/dashboard/${saveId}/contracts`}
              className="text-amber-400 hover:underline"
            >
              View contracts
            </Link>
          </div>
        ) : (
          <EmptyState message="No contract on file." />
        )}
      </Section>

      <Section title="Attributes">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {Object.entries(player.attributes).map(([key, value]) => (
            <div
              key={key}
              className="rounded-lg border border-zinc-800 px-3 py-2 text-sm"
            >
              <p className="text-xs capitalize text-zinc-500">
                {key.replace(/([A-Z])/g, " $1")}
              </p>
              <p className="font-mono text-zinc-100">{value}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Season stats">
        {player.seasonStats.games === 0 ? (
          <EmptyState message="No final-game box scores yet for this player." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Info label="Games" value={String(player.seasonStats.games)} />
            <Info label="Points" value={String(player.seasonStats.points)} />
            <Info label="Rebounds" value={String(player.seasonStats.rebounds)} />
            <Info label="Assists" value={String(player.seasonStats.assists)} />
            <Info label="Steals" value={String(player.seasonStats.steals)} />
            <Info label="Blocks" value={String(player.seasonStats.blocks)} />
            <Info
              label="Turnovers"
              value={String(player.seasonStats.turnovers)}
            />
            <Info label="Minutes" value={String(player.seasonStats.minutes)} />
          </div>
        )}
      </Section>

      {canTrade ? (
        <Section title="Actions">
          <ConfirmDialog
            title="Execute trade"
            description="Find and execute the first acceptable 1-for-1 trade for this player using the canonical trade system."
            confirmLabel="Trade"
          >
            <form action={executeTradeAction}>
              <input type="hidden" name="saveId" value={saveId} />
              <input type="hidden" name="outgoingPlayerId" value={playerId} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <button
                type="submit"
                className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-500"
              >
                Confirm trade
              </button>
            </form>
          </ConfirmDialog>
        </Section>
      ) : null}
    </>
  );
}

function Info(props: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="text-xs text-zinc-500">{props.label}</p>
      <p className="mt-1 text-sm text-zinc-100">{props.value}</p>
    </div>
  );
}
