import {
  MediaStoryCard,
  type MediaStoryCardProps,
} from "@/components/media-hub/MediaStoryCard";
import { EmptyState } from "@/components/owner/EmptyState";

export function MediaFeed(props: {
  items: MediaStoryCardProps[];
  emptyMessage?: string;
  featuredStoryId: string | null;
}) {
  if (props.items.length === 0) {
    return (
      <EmptyState
        message={props.emptyMessage ?? "No stories in this feed yet."}
      />
    );
  }

  const rest = props.featuredStoryId
    ? props.items.filter((item) => item.id !== props.featuredStoryId)
    : props.items;

  if (rest.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <section aria-label="Latest stories">
        <ul className="space-y-3">
          {rest.map((item) => (
            <li key={item.id}>
              <MediaStoryCard {...item} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
