/**
 * Dev-only visual QA page for the Media Hub timeline components. Visit
 * /dev/media-showcase while running `npm run dev`. Renders fictional posts
 * covering every attachment type and author kind under a very dark and a very
 * light team. Not linked from production navigation.
 */

import {
  TimelineFeed,
  TimelineLoadMore,
} from "@/components/media-hub/timeline/TimelineFeed";
import { TimelinePost } from "@/components/media-hub/timeline/TimelinePost";
import { SectionHeading } from "@/components/ui";
import { SHOWCASE_CONTEXT, SHOWCASE_POSTS } from "./sample-posts";

export default function MediaShowcasePage() {
  return (
    <main className="min-h-screen bg-surface-deep px-4 py-8 text-zinc-100 sm:px-6">
      <SectionHeading
        as="h1"
        size="lg"
        eyebrow="Dev / visual QA"
        title="Media timeline"
      />
      <p className="mt-3 max-w-2xl text-sm text-zinc-400">
        Fictional posts for every attachment type and author kind, with HAR
        (very dark primary) and SUM (very light primary) branding.
      </p>

      <div className="mx-auto mt-10 max-w-[640px]">
        <TimelineFeed>
          {SHOWCASE_POSTS.map((post) => (
            <TimelinePost
              key={post.id}
              post={post}
              context={SHOWCASE_CONTEXT}
            />
          ))}
        </TimelineFeed>

        <section className="mt-12">
          <SectionHeading as="h2" eyebrow="Variant" title="Compact" />
          <div className="mt-3">
            {SHOWCASE_POSTS.slice(0, 3).map((post) => (
              <TimelinePost
                key={post.id}
                post={post}
                context={SHOWCASE_CONTEXT}
                compact
              />
            ))}
          </div>
        </section>

        <div className="mt-8">
          <TimelineLoadMore href="/dev/media-showcase?before=showcase" />
        </div>
      </div>
    </main>
  );
}
