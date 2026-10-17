import Link from "next/link";
import type { NotificationView } from "@/state/selectors";
import { NotificationItem } from "@/components/owner/NotificationItem";
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
            <li key={notification.id}>
              <NotificationItem
                id={notification.id}
                title={notification.title}
                message={notification.message}
                occurredOn={notification.occurredOn}
                severity={notification.severity}
                read={notification.read}
                type={notification.type}
              />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
