import type { EventLogEntryView } from "@/state/selectors";
import { EventCard } from "@/components/game/EventCard";
import { EmptyState } from "@/components/owner/EmptyState";
import { Section } from "@/components/owner/Section";

export function RecentActivity(props: { activity: EventLogEntryView[] }) {
  return (
    <Section title="Recent Activity">
      {props.activity.length === 0 ? (
        <EmptyState message="No recent franchise activity yet." />
      ) : (
        <ul className="space-y-2">
          {props.activity.map((entry) => (
            <EventCard
              key={entry.id}
              title={entry.description}
              date={entry.occurredOn}
              type={entry.type}
              amount={entry.amount}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}
