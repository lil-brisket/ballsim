import Link from "next/link";
import { getGameModeDefinition } from "@/application/game-mode-catalog";
import type { DashboardSnapshot } from "@/state/selectors";
import { OwnerTeamSwitcher } from "@/components/game/OwnerTeamSwitcher";
import { cn, focusRingClass, panelClass } from "@/components/ui/styles";

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
      className={cn(
        "relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-700 text-zinc-300 hover:border-amber-600 hover:text-amber-400",
        focusRingClass,
      )}
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

/**
 * Global in-save header: where am I, who am I managing, what day is it?
 * Financial snapshot lives on Dashboard / Finances — not here.
 */
export function GameHeader(props: {
  saveId: string;
  saveName: string;
  dashboard: DashboardSnapshot;
}) {
  const { dashboard, saveId } = props;
  const modeDef = getGameModeDefinition(dashboard.mode);
  const record = `${dashboard.controlledStanding.wins}–${dashboard.controlledStanding.losses}`;

  return (
    <header
      className={cn(
        panelClass,
        "flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4",
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/home"
            className={cn(
              "text-sm font-medium text-zinc-100 hover:text-amber-400",
              focusRingClass,
            )}
          >
            BallSim
          </Link>
          <span className="hidden text-zinc-700 sm:inline" aria-hidden>
            |
          </span>
          <span className="hidden font-mono text-[0.65rem] uppercase tracking-[0.16em] text-amber-500 sm:inline">
            {modeDef.name}
          </span>
        </div>

        <OwnerTeamSwitcher
          saveId={saveId}
          ownedTeams={dashboard.ownedTeams}
        />
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-3 sm:justify-end">
        <div className="min-w-0">
          <p className="font-mono text-sm text-zinc-200">
            {dashboard.currentDate}
          </p>
          <p className="text-xs text-zinc-500">
            Season {dashboard.seasonYear}
          </p>
        </div>

        <span className="hidden text-zinc-700 sm:inline" aria-hidden>
          |
        </span>

        <p className="min-w-0 truncate text-sm text-zinc-300">
          <span className="font-mono text-zinc-100">{record}</span>
          <span className="text-zinc-500"> · </span>
          <span className="text-zinc-400">#{dashboard.standingsRank}</span>
        </p>

        <NotificationsBell
          saveId={saveId}
          unreadCount={dashboard.unreadNotificationCount}
        />
      </div>
    </header>
  );
}
