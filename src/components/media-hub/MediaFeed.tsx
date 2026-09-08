import {
  MediaStoryCard,
  type MediaStoryCardProps,
} from "@/components/media-hub/MediaStoryCard";
import { EmptyState } from "@/components/owner/EmptyState";
import { pickFeaturedStoryId } from "@/components/media-hub/media-importance-tiers";

export function MediaFeed(props: {
  items: MediaStoryCardProps[];
  emptyMessage?: string;
  /** When true, lift top major story as Featured. */
  showFeatured?: boolean;
}) {
  if (props.items.length === 0) {
    return (
      <EmptyState
        message={props.emptyMessage ?? "No stories in this feed yet."}
      />
    );
  }

  const featuredId =
    props.showFeatured === false
      ? null
      : pickFeaturedStoryId(
          props.items.map((item) => ({
            id: item.id,
            importance: item.importance,
            relevanceScore: item.relevanceScore ?? 0,
            occurredOn: item.occurredOn,
          })),
        );

  const featured = featuredId
    ? props.items.find((i) => i.id === featuredId)
    : null;
  const rest = featuredId
    ? props.items.filter((i) => i.id !== featuredId)
    : props.items;

  return (
    <div className="space-y-6">
      {featured ? (
        <section aria-label="Featured story">
          <MediaStoryCard {...featured} featured />
        </section>
      ) : null}

      {rest.length > 0 ? (
        <section aria-label="Latest stories">
          {featured ? (
            <h2 className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-zinc-500">
              Latest
            </h2>
          ) : null}
          <ul className="space-y-3">
            {rest.map((item) => (
              <li key={item.id}>
                <MediaStoryCard {...item} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
