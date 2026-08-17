import Link from "next/link";
import type { NotificationView } from "@/state/selectors";
import { EventCard } from "@/components/game/EventCard";
import { EmptyState } from "@/components/owner/EmptyState";
import { Section } from "@/components/owner/Section";

export function DashboardNotifications(props: {
  notifications: NotificationView[];
  saveId: string;
}) {
  return (
    <Section
      title="Notifications"
      action={
        <Link
          href={`/dashboard/${props.saveId}/notifications`}
          className="text-sm text-amber-400 hover:text-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          View all
        </Link>
      }
    >
      {props.notifications.length === 0 ? (
        <EmptyState message="No recent notifications." />
      ) : (
        <ul className="space-y-2">
          {props.notifications.map((notification) => (
            <EventCard
              key={notification.id}
              title={notification.title}
              description={notification.message}
              date={notification.occurredOn}
              type={notification.type}
              severity={notification.severity}
              read={notification.read}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}
