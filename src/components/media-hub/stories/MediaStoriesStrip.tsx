import { TimelinePost } from "@/components/media-hub/timeline/TimelinePost";
import type {
  TimelineDisplayContext,
  TimelinePostView,
} from "@/state/media-timeline/post-view";
import { StoriesViewer } from "./StoriesViewer";

type StoryRingInput = {
  key: string;
  label: string;
  latestOn: string;
  slides: TimelinePostView[];
};

/**
 * Server component: renders every slide on the server (so the state layer and
 * the post components stay out of the client bundle) and hands the finished
 * nodes to the client-side viewer.
 */
export function MediaStoriesStrip(props: {
  saveId: string;
  rings: readonly StoryRingInput[];
  context: TimelineDisplayContext;
}) {
  const rings = props.rings.filter((ring) => ring.slides.length > 0);
  if (rings.length === 0) return null;
  return (
    <StoriesViewer
      saveId={props.saveId}
      rings={rings.map((ring) => ({
        key: ring.key,
        label: ring.label,
        latestOn: ring.latestOn,
        slideCount: ring.slides.length,
        slides: ring.slides.map((slide) => (
          <TimelinePost key={slide.id} post={slide} context={props.context} />
        )),
      }))}
    />
  );
}
