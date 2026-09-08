import {
  SocialPostCard,
  type SocialPostCardProps,
} from "@/components/media-hub/SocialPostCard";
import { EmptyState } from "@/components/owner/EmptyState";

export type SocialPostWithStory = SocialPostCardProps & {
  relatedMediaId?: string;
  relatedHeadline?: string;
};

/**
 * Social feed as reaction clusters tied to parent stories — not a Twitter dump.
 */
export function SocialFeed(props: {
  posts: SocialPostWithStory[];
  emptyMessage?: string;
  mediaHrefBase?: string;
}) {
  if (props.posts.length === 0) {
    return (
      <EmptyState
        message={props.emptyMessage ?? "No social reactions yet."}
      />
    );
  }

  // Cluster by relatedMediaId; ungrouped posts last
  const clusters = new Map<string, SocialPostWithStory[]>();
  const ungrouped: SocialPostWithStory[] = [];
  for (const post of props.posts) {
    if (post.relatedMediaId) {
      const list = clusters.get(post.relatedMediaId) ?? [];
      list.push(post);
      clusters.set(post.relatedMediaId, list);
    } else {
      ungrouped.push(post);
    }
  }

  return (
    <div className="space-y-6">
      {[...clusters.entries()].map(([mediaId, posts]) => {
        const headline = posts[0]?.relatedHeadline;
        return (
          <section
            key={mediaId}
            className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3"
            aria-label={headline ?? "Story reactions"}
          >
            <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-zinc-500">
              Reactions
              {headline ? (
                <span className="ml-2 normal-case tracking-normal text-zinc-400">
                  · {headline}
                </span>
              ) : null}
            </p>
            <ul className="space-y-2">
              {posts.map((post) => (
                <li key={post.id}>
                  <SocialPostCard {...post} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {ungrouped.length > 0 ? (
        <ul className="space-y-2">
          {ungrouped.map((post) => (
            <li key={post.id}>
              <SocialPostCard {...post} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
