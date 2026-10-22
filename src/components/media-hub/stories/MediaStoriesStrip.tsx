import type { ReactNode } from "react";
import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { teamBrandingFor } from "@/components/media-hub/timeline/attachment-parts";
import { TeamMark } from "@/components/media-hub/timeline/TeamMark";
import { heroTeamOf } from "@/components/media-hub/timeline/TopStoryHero";
import type {
  TimelineDisplayContext,
  TimelinePostView,
} from "@/state/media-timeline/post-view";
import type {
  TimelineAttachment,
  TimelinePlayerRef,
} from "@/state/media-timeline/types";
import { StoriesViewer, type StoryRingMediaKind } from "./StoriesViewer";
import { StorySlide } from "./StorySlide";

type StoryRingInput = {
  key: string;
  label: string;
  latestOn: string;
  slides: TimelinePostView[];
};

function leadPlayerOf(
  attachment: TimelineAttachment,
): TimelinePlayerRef | null {
  switch (attachment.type) {
    case "performance":
    case "injury":
    case "signing":
      return attachment.player;
    case "award":
      return attachment.winner;
    default:
      return null;
  }
}

/** Hand-drawn trophy for award rings whose lead has no player. */
function TrophyMark() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="text-team-ink"
    >
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 20h8" />
    </svg>
  );
}

/** The face or logo on a ring: the lead slide's player, else its team. */
function leadMedia(
  post: TimelinePostView,
  context: TimelineDisplayContext,
): { kind: StoryRingMediaKind; node: ReactNode } {
  const team = heroTeamOf(post.attachment);
  const branding = team ? teamBrandingFor(context, team) : null;
  const player = leadPlayerOf(post.attachment);
  if (player) {
    return {
      kind: "portrait",
      node: (
        <PlayerPortrait
          playerId={player.playerId}
          firstName={player.firstName}
          lastName={player.lastName}
          size="md"
          portrait={context.portraits[player.playerId] ?? null}
          uniform={
            branding
              ? {
                  primaryColor: branding.primaryColor,
                  secondaryColor: branding.secondaryColor,
                }
              : null
          }
        />
      ),
    };
  }
  if (post.attachment.type === "award") {
    return { kind: "trophy", node: <TrophyMark /> };
  }
  return { kind: "logo", node: <TeamMark branding={branding} size="lg" /> };
}

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
      rings={rings.map((ring) => {
        const media = leadMedia(ring.slides[0]!, props.context);
        return {
          key: ring.key,
          label: ring.label,
          latestOn: ring.latestOn,
          slideCount: ring.slides.length,
          mediaKind: media.kind,
          media: media.node,
          slides: ring.slides.map((slide) => (
            <StorySlide
              key={slide.id}
              post={slide}
              context={props.context}
              saveId={props.saveId}
            />
          )),
        };
      })}
    />
  );
}
