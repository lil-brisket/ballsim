import {
  SocialPostCard,
  type SocialPostCardProps,
} from "@/components/media-hub/SocialPostCard";
import { EmptyState } from "@/components/owner/EmptyState";

export function SocialFeed(props: {
  posts: SocialPostCardProps[];
  emptyMessage?: string;
}) {
  if (props.posts.length === 0) {
    return (
      <EmptyState
        message={props.emptyMessage ?? "No social posts yet."}
      />
    );
  }

  return (
    <ul className="space-y-2">
      {props.posts.map((post) => (
        <li key={post.id}>
          <SocialPostCard {...post} />
        </li>
      ))}
    </ul>
  );
}
