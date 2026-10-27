import { buttonClass } from "@/components/ui/Button";
import type { Metadata } from "next";
import {
  cn,
  focusRingClass,
  linkClass,
  touchTargetTextClass,
} from "@/components/ui/styles";
import { ViewSwitch } from "@/components/ui/ViewSwitch";
import { notFound } from "next/navigation";
import {
  markNotificationsReadAction,
  switchActiveOwnerTeamAction,
} from "@/application/actions";
import { loadOwnerSaveView } from "@/application/game-service";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { NotificationItem } from "@/components/owner/NotificationItem";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Notifications" };

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

  const base = `/dashboard/${saveId}/notifications`;
  const returnPath = base;
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
              className={buttonClass({ variant: "secondary" })}
            >
              Mark all read
            </button>
          </form>
        }
      />
      {error ? <ErrorState message={error} /> : null}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <ViewSwitch
          aria-label="Filter by team"
          className="max-w-full flex-wrap"
          activeKey={team && ownedTeams.some((o) => o.id === team) ? team : ""}
          items={[
            { key: "", label: "All Teams", href: base },
            ...ownedTeams.map((owned) => ({
              key: owned.id,
              label: owned.abbreviation,
              href: `${base}?team=${owned.id}`,
            })),
          ]}
        />
        <ViewSwitch
          aria-label="Filter by type"
          className="max-w-full flex-wrap"
          activeKey={type && types.includes(type) ? type : ""}
          items={[
            {
              key: "",
              label: "All types",
              href: team ? `${base}?team=${team}` : base,
            },
            ...types.map((notificationType) => ({
              key: notificationType,
              label: notificationType,
              href: `${base}?${new URLSearchParams({
                ...(team ? { team } : {}),
                type: notificationType,
              }).toString()}`,
            })),
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No notifications yet." />
      ) : (
        <ul className="space-y-2">
          {filtered.map((notification) => (
            <li key={`${notification.teamId}:${notification.id}`}>
              <div className="mb-1 flex items-center justify-between gap-2 text-sm text-faint">
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
                      className={cn(
                        linkClass,
                        touchTargetTextClass,
                        focusRingClass,
                      )}
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
                type={notification.type}
                teamName={notification.teamName}
                branding={
                  ownedTeams.find((owned) => owned.id === notification.teamId)
                    ?.branding ?? null
                }
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
