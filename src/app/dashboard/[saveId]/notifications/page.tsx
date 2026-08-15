import { notFound } from "next/navigation";
import { markNotificationsReadAction } from "@/application/actions";
import { loadOwnerSaveView } from "@/application/game-service";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { NotificationItem } from "@/components/owner/NotificationItem";
import { PageHeader } from "@/components/owner/PageHeader";

type NotificationsPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string; type?: string }>;
};

export default async function NotificationsPage({
  params,
  searchParams,
}: NotificationsPageProps) {
  const { saveId } = await params;
  const { error, type } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  const returnPath = `/dashboard/${saveId}/notifications`;
  const types = Array.from(
    new Set(view.notifications.map((notification) => notification.type)),
  ).sort();
  const filtered =
    type && type.length > 0
      ? view.notifications.filter((notification) => notification.type === type)
      : view.notifications;

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Things the owner needs to notice"
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
            !type
              ? "border-amber-600 text-amber-400"
              : "border-zinc-700 text-zinc-400"
          }`}
        >
          All
        </a>
        {types.map((notificationType) => (
          <a
            key={notificationType}
            href={`/dashboard/${saveId}/notifications?type=${notificationType}`}
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
        <ul className="space-y-3">
          {filtered.map((notification) => {
            const href =
              notification.type.includes("financial") ||
              notification.type === "significant_financial_change"
                ? `/dashboard/${saveId}/finances`
                : notification.relatedObjectiveId
                  ? `/dashboard/${saveId}`
                  : undefined;
            return (
              <li key={notification.id} className="space-y-2">
                <NotificationItem
                  id={notification.id}
                  title={notification.title}
                  message={notification.message}
                  occurredOn={notification.occurredOn}
                  severity={notification.severity}
                  read={notification.read}
                  href={href}
                />
                {!notification.read ? (
                  <form action={markNotificationsReadAction}>
                    <input type="hidden" name="saveId" value={saveId} />
                    <input
                      type="hidden"
                      name="notificationId"
                      value={notification.id}
                    />
                    <input type="hidden" name="returnPath" value={returnPath} />
                    <button
                      type="submit"
                      className="text-xs text-zinc-500 hover:text-amber-400"
                    >
                      Mark read
                    </button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
