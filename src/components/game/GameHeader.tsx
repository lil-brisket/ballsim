import Link from "next/link";
import { getGameModeDefinition } from "@/application/game-mode-catalog";
import type { DashboardSnapshot } from "@/state/selectors";
import { PhaseBadge } from "@/components/game/PhaseBadge";
import { OwnerTeamSwitcher } from "@/components/game/OwnerTeamSwitcher";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";

function NotificationsBell(props: {
  saveId: string;
  unreadCount: number;
}) {
  const href = `/dashboard/${props.saveId}/notifications`;
  const label =
    props.unreadCount > 0
      ? `Notifications, ${props.unreadCount} unread`
      : "Notifications";

  return (
    <Link
      href={href}
      aria-label={label}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-700 text-zinc-300 hover:border-amber-600 hover:text-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {props.unreadCount > 0 ? (
        <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-amber-500 px-1 font-mono text-[0.65rem] font-semibold leading-4 text-zinc-950">
          {props.unreadCount > 99 ? "99+" : props.unreadCount}
        </span>
      ) : null}
    </Link>
  );
}

export function GameHeader(props: {
  saveId: string;
  saveName: string;
  dashboard: DashboardSnapshot;
}) {
  const { dashboard, saveName, saveId } = props;
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
        <div className="flex items-center gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-500">
            {modeDef.name}
          </p>
          <NotificationsBell
            saveId={saveId}
            unreadCount={dashboard.unreadNotificationCount}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <OwnerTeamSwitcher
            saveId={saveId}
            ownedTeams={dashboard.ownedTeams}
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
          <div className="hidden sm:block">
            <p className="text-xs uppercase tracking-wide text-zinc-600">
              Business Funds
            </p>
            <MoneyDisplay amount={dashboard.cash} className="text-zinc-200" />
          </div>
          <div className="hidden sm:block">
            <p className="text-xs uppercase tracking-wide text-zinc-600">
              Cap Space
            </p>
            <MoneyDisplay
              amount={dashboard.capSpace}
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
