import {
  MediaStoryCard,
  type MediaStoryCardProps,
} from "@/components/media-hub/MediaStoryCard";
import { EmptyState } from "@/components/owner/EmptyState";

export function MediaFeed(props: {
  items: MediaStoryCardProps[];
  emptyMessage?: string;
}) {
  if (props.items.length === 0) {
    return (
      <EmptyState
        message={props.emptyMessage ?? "No stories in this feed yet."}
      />
    );
  }

  return (
    <ul className="space-y-2">
      {props.items.map((item) => (
        <li key={item.id}>
          <MediaStoryCard {...item} />
        </li>
      ))}
    </ul>
  );
}
