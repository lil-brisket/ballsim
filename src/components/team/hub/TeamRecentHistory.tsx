import { EmptyState } from "@/components/owner/EmptyState";
import { Section } from "@/components/owner/Section";
import { RecentHistoryItem } from "@/components/team/hub/RecentHistoryItem";
import type { TeamRecentHistoryItem } from "@/state/team-recent-history-selectors";

export function TeamRecentHistory(props: {
  saveId: string;
  items: TeamRecentHistoryItem[];
}) {
  return (
    <Section title="Recent History">
      {props.items.length === 0 ? (
        <EmptyState message="No recent team events yet." />
      ) : (
        <ul className="space-y-2">
          {props.items.map((item) => (
            <RecentHistoryItem
              key={item.id}
              saveId={props.saveId}
              item={item}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}
