/**
 * Fictional engagement counts. Derived from notability (strongly) and
 * relevance (mildly) times a seeded jitter that does not depend on
 * notability, so for one post id a bigger story never has smaller counts.
 */

import { hashParts, unitFromHash } from "./seed";
import type { TimelinePost } from "./types";

export type Engagement = {
  replies: number;
  reposts: number;
  likes: number;
};

function jitter(saveId: string, postId: string, salt: string): number {
  return 0.8 + 0.4 * unitFromHash(hashParts(saveId, postId, salt));
}

export function computeEngagement(
  saveId: string,
  post: Pick<TimelinePost, "id" | "notability" | "relevance">,
  visibleReplyCount: number,
): Engagement {
  const notability = Math.min(100, Math.max(0, post.notability));
  const relevance = Math.min(100, Math.max(0, post.relevance));
  // About 40 likes at notability 30 and about 5,500 at 100.
  const base = 5 * Math.exp(0.07 * notability) * (1 + relevance / 200);
  const likes = Math.max(
    1,
    Math.round(base * jitter(saveId, post.id, "likes")),
  );
  const repostRatio =
    0.12 + 0.1 * unitFromHash(hashParts(saveId, post.id, "rp"));
  const replyRatio =
    0.04 + 0.04 * unitFromHash(hashParts(saveId, post.id, "rl"));
  const reposts = Math.min(
    likes,
    Math.round(base * jitter(saveId, post.id, "likes") * repostRatio),
  );
  const replies = Math.max(
    Math.max(0, visibleReplyCount),
    Math.round(base * jitter(saveId, post.id, "likes") * replyRatio),
  );
  return { replies, reposts, likes };
}

export function formatCount(n: number): string {
  const value = Math.max(0, Math.round(n));
  if (value < 1000) return String(value);
  if (value < 10_000) return `${trimDecimal(value / 1000)}K`;
  if (value < 1_000_000) {
    const thousands = Math.round(value / 1000);
    return thousands >= 1000 ? "1M" : `${thousands}K`;
  }
  return `${trimDecimal(value / 1_000_000)}M`;
}

function trimDecimal(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

function plural(n: number, one: string, many: string): string {
  return `${formatCount(n)} ${n === 1 ? one : many}`;
}

/** "214 replies, 1.2K reposts, 5.8K likes" (singular for 1). */
export function engagementLabel(e: Engagement): string {
  return [
    plural(e.replies, "reply", "replies"),
    plural(e.reposts, "repost", "reposts"),
    plural(e.likes, "like", "likes"),
  ].join(", ");
}
