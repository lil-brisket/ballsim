import Link from "next/link";
import { notFound } from "next/navigation";
import {
  markNotificationsReadAction,
  switchActiveOwnerTeamAction,
} from "@/application/actions";
import { loadOwnerSaveView } from "@/application/game-service";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { NotificationItem } from "@/components/owner/NotificationItem";
import { PageHeader } from "@/components/owner/PageHeader";

type NotificationsPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string; type?: string; team?: string }>;
};

export default async function NotificationsPage({
  params,
  searchParams,
}: NotificationsPageProps) {
  const { saveId } = await params;
  const { error, type, team } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  const returnPath = `/dashboard/${saveId}/notifications`;
  const ownedTeams = view.dashboard.ownedTeams;
  const types = Array.from(
    new Set(view.notifications.map((notification) => notification.type)),
  ).sort();

  let filtered = view.notifications;
  if (team && team.length > 0) {
    filtered = filtered.filter((notification) => notification.teamId === team);
  }
  if (type && type.length > 0) {
    filtered = filtered.filter((notification) => notification.type === type);
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Attention across all franchises you control"
        actions={
          <form action={markNotificationsReadAction}>
            <input type="hidden" name="saveId" value={saveId} />
            <input type="hidden" name="returnPath" value={returnPath} />
            <button
              type="submit"
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-amber-600"
            >
              Mark all read
            </button>
          </form>
        }
      />
      {error ? <ErrorState message={error} /> : null}

      <div className="flex flex-wrap gap-2">
        <a
          href={`/dashboard/${saveId}/notifications`}
          className={`rounded-full border px-3 py-1 text-xs ${
            !team
              ? "border-amber-600 text-amber-400"
              : "border-zinc-700 text-zinc-400"
          }`}
        >
          All Teams
        </a>
        {ownedTeams.map((owned) => (
          <a
            key={owned.id}
            href={`/dashboard/${saveId}/notifications?team=${owned.id}`}
            className={`rounded-full border px-3 py-1 text-xs ${
              team === owned.id
                ? "border-amber-600 text-amber-400"
                : "border-zinc-700 text-zinc-400"
            }`}
          >
            {owned.abbreviation}
          </a>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={
            team
              ? `/dashboard/${saveId}/notifications?team=${team}`
              : `/dashboard/${saveId}/notifications`
          }
          className={`rounded-full border px-3 py-1 text-xs ${
            !type
              ? "border-amber-600 text-amber-400"
              : "border-zinc-700 text-zinc-400"
          }`}
        >
          All types
        </a>
        {types.map((notificationType) => (
          <a
            key={notificationType}
            href={`/dashboard/${saveId}/notifications?${new URLSearchParams({
              ...(team ? { team } : {}),
              type: notificationType,
            }).toString()}`}
            className={`rounded-full border px-3 py-1 text-xs ${
              type === notificationType
                ? "border-amber-600 text-amber-400"
                : "border-zinc-700 text-zinc-400"
            }`}
          >
            {notificationType}
          </a>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No notifications yet." />
      ) : (
        <ul className="space-y-2">
          {filtered.map((notification) => (
            <li key={`${notification.teamId}:${notification.id}`}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs text-zinc-500">
                <span>{notification.teamName}</span>
                {notification.teamId !== view.dashboard.controlledTeam.id ? (
                  <form action={switchActiveOwnerTeamAction}>
                    <input type="hidden" name="saveId" value={saveId} />
                    <input
                      type="hidden"
                      name="teamId"
                      value={notification.teamId}
                    />
                    <button
                      type="submit"
                      className="text-amber-400 hover:underline"
                    >
                      Switch to team
                    </button>
                  </form>
                ) : null}
              </div>
              <NotificationItem
                id={notification.id}
                title={notification.title}
                message={notification.message}
                occurredOn={notification.occurredOn}
                severity={notification.severity}
                read={notification.read}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
