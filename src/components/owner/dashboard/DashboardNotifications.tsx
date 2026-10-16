import Link from "next/link";
import type { NotificationView } from "@/state/selectors";
import { EventCard } from "@/components/game/EventCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import {
  focusRingClass,
  linkClass,
  touchTargetTextClass,
} from "@/components/ui/styles";

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
          className={`${touchTargetTextClass} ${linkClass} text-sm ${focusRingClass}`}
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
