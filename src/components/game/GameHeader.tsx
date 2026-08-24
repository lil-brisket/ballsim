import Link from "next/link";
import { getGameModeDefinition } from "@/application/game-mode-catalog";
import type { DashboardSnapshot } from "@/state/selectors";
import { PhaseBadge } from "@/components/game/PhaseBadge";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { TeamBadge } from "@/components/owner/TeamBadge";

export function GameHeader(props: {
  saveName: string;
  dashboard: DashboardSnapshot;
}) {
  const { dashboard, saveName } = props;
  const modeDef = getGameModeDefinition(dashboard.mode);
  const record = `${dashboard.controlledStanding.wins}-${dashboard.controlledStanding.losses}`;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/home"
          className="text-sm text-zinc-400 hover:text-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          ← Home
        </Link>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-500">
          {modeDef.name}
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <TeamBadge
            city={dashboard.controlledTeam.city}
            name={dashboard.controlledTeam.name}
            abbreviation={dashboard.controlledTeam.abbreviation}
          />
          <div className="flex flex-wrap items-center gap-2">
            <PhaseBadge
              seasonPhase={dashboard.seasonPhase}
              offseasonStage={dashboard.offseasonStage}
              displayLabel={dashboard.calendarDisplayLabel}
            />
            <span className="text-sm text-zinc-400">
              Record {record} · #{dashboard.standingsRank}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-600">Date</p>
            <p className="font-mono text-zinc-200">{dashboard.currentDate}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-600">
              Season
            </p>
            <p className="text-zinc-200">{dashboard.seasonYear}</p>
          </div>
          {/* Financial summary: desktop header only; mobile uses dashboard content */}
          <div className="hidden sm:block">
            <p className="text-xs uppercase tracking-wide text-zinc-600">Cash</p>
            <MoneyDisplay amount={dashboard.cash} className="text-zinc-200" />
          </div>
          <div className="hidden sm:block">
            <p className="text-xs uppercase tracking-wide text-zinc-600">
              Payroll
            </p>
            <MoneyDisplay
              amount={dashboard.payroll}
              className="text-zinc-200"
            />
          </div>
          <div className="hidden md:block">
            <p className="text-xs uppercase tracking-wide text-zinc-600">
              Save
            </p>
            <p className="text-zinc-300">{saveName}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
