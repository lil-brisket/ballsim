import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { StatusBadge } from "@/components/owner/StatusBadge";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import type { PlayerProfileView } from "@/state/player-profile-selectors";

export function PlayerProfileHeader(props: {
  player: PlayerProfileView;
}) {
  const { player } = props;

  return (
    <header className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-5 py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">
            {player.firstName} {player.lastName}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-zinc-400">
            <span>
              {player.position} · Age {player.age} ·
            </span>
            {player.teamBranding ? (
              <span
                className="inline-flex shrink-0 items-center justify-center rounded-sm p-0.5"
                style={{
                  backgroundColor: player.teamBranding.primaryColor,
                }}
              >
                <TeamLogoMark
                  branding={player.teamBranding}
                  size="sm"
                  decorative
                />
              </span>
            ) : null}
            <span>{player.teamName ?? "Free agent"}</span>
          </p>
          <p className="mt-1 text-xs capitalize text-zinc-500">
            {player.archetype.replace(/_/g, " ")} · {player.nationality} ·{" "}
            {player.heightInches}&quot; / {player.weightPounds} lbs
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-4 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wide text-amber-500/80">
              Overall
            </p>
            <p className="font-mono text-2xl text-amber-400">{player.overall}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 px-4 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">
              Potential
            </p>
            <p className="font-mono text-xl text-zinc-100">
              {player.potentialOverall}
            </p>
          </div>
          <div className="space-y-1">
            <StatusBadge label={player.developmentStage} />
            <StatusBadge
              label={player.injuryKind}
              tone={player.injuryKind}
            />
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-4 text-sm">
        {player.contract ? (
          <>
            <MoneyDisplay amount={player.contract.salary ?? 0} />
            <span className="text-zinc-400">
              {player.contract.startYear}–{player.contract.endYear} (
              {player.contract.yearsRemaining}y)
            </span>
            <StatusBadge label={player.contract.status} />
          </>
        ) : (
          <span className="text-zinc-500">No contract on file</span>
        )}
      </div>
    </header>
  );
}
