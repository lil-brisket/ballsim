import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import {
  RecentHistoryItem,
  type RecentHistoryItemProps,
} from "@/components/team/hub/RecentHistoryItem";
import type { TeamRecentHistoryItem } from "@/state/team-recent-history-selectors";

export function TeamRecentHistory(props: {
  saveId: string;
  items: TeamRecentHistoryItem[];
  team: RecentHistoryItemProps["team"];
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
              team={props.team}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}
