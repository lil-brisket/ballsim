/**
 * Dev-only visual QA page for the Media Hub timeline components. Visit
 * /dev/media-showcase while running `npm run dev`. Renders fictional posts
 * covering every attachment type and author kind under a very dark, a very
 * light and a neon team, plus the shared pieces timeline cards are built from. Not linked from production navigation.
 */

import { MediaStoriesStrip } from "@/components/media-hub/stories/MediaStoriesStrip";
import {
  TimelineFeed,
  TimelineLoadMore,
} from "@/components/media-hub/timeline/TimelineFeed";
import { TimelinePost } from "@/components/media-hub/timeline/TimelinePost";
import {
  AccountAvatar,
  type AccountAvatarSize,
} from "@/components/media-hub/timeline/AccountAvatar";
import { StatLine } from "@/components/media-hub/timeline/StatLine";
import {
  TeamSurface,
  TeamSurfaceSlab,
} from "@/components/media-hub/timeline/TeamSurface";
import { UnreadDot } from "@/components/media-hub/timeline/UnreadDot";
import { VerifiedMark } from "@/components/media-hub/timeline/VerifiedMark";
import { SectionHeading } from "@/components/ui";
import type { TimelineAccount } from "@/state/media-timeline/accounts";
import { SHOWCASE_CONTEXT, SHOWCASE_POSTS } from "./sample-posts";

const SHARED_TEAMS = [
  { id: "har", name: "Harbor Lights", note: "very dark" },
  { id: "sum", name: "Summit Peaks", note: "very light" },
  { id: "neo", name: "Neon Volts", note: "neon" },
] as const;

const AVATAR_SIZES: AccountAvatarSize[] = ["reply", "post", "large"];

function sampleAccounts(teamId: string, name: string): TimelineAccount[] {
  const base = {
    verified: false,
    teamId,
    playerId: null,
    beat: null,
  };
  return [
    {
      ...base,
      key: "league",
      kind: "league",
      displayName: "Premier Hoops League",
      handle: "@PHLOffice",
      avatar: { type: "league", letters: "PHL" },
    },
    {
      ...base,
      key: `logo:${teamId}`,
      kind: "team",
      displayName: name,
      handle: `@${teamId}`,
      avatar: { type: "logo", teamId },
    },
    {
      ...base,
      key: `portrait:${teamId}`,
      kind: "player",
      displayName: "Teo Valdane",
      handle: "@TeoValdane",
      playerId: "p_valdane",
      avatar: { type: "portrait", playerId: "p_valdane" },
    },
    {
      ...base,
      key: `monogram:${teamId}`,
      kind: "fan",
      displayName: `${name} Fans`,
      handle: "@fans",
      avatar: { type: "monogram", initials: "FN", teamId },
    },
  ];
}

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
        <MediaStoriesStrip
          saveId={SHOWCASE_CONTEXT.saveId}
          context={SHOWCASE_CONTEXT}
          rings={[
            {
              key: "last-night",
              label: "Last night",
              latestOn: SHOWCASE_POSTS[0]!.occurredOn,
              slides: SHOWCASE_POSTS.slice(0, 3),
            },
            {
              key: "awards",
              label: "Awards",
              latestOn: SHOWCASE_POSTS[0]!.occurredOn,
              slides: SHOWCASE_POSTS.slice(3, 5),
            },
          ]}
        />
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

        <section className="mt-12 space-y-8">
          <SectionHeading as="h2" eyebrow="Variant" title="Shared pieces" />
          {SHARED_TEAMS.map((team) => {
            const branding = SHOWCASE_CONTEXT.teams[team.id]?.branding ?? null;
            return (
              <div key={team.id} className="space-y-3">
                <p className="text-sm text-zinc-400">
                  {team.name} ({team.note})
                </p>
                <TeamSurface branding={branding} band="left">
                  <p className="text-sm text-zinc-100">Left band surface</p>
                </TeamSurface>
                <TeamSurface branding={branding} band="top" className="p-0">
                  <TeamSurfaceSlab>
                    <span className="font-display text-lg font-extrabold">
                      {team.name}
                    </span>
                  </TeamSurfaceSlab>
                  <div className="p-4">
                    <StatLine
                      primary={[
                        { label: "Points", value: "31" },
                        { label: "Rebounds", value: "8", tone: "win" },
                        { label: "Turnovers", value: "6", tone: "loss" },
                      ]}
                      secondary={[
                        { label: "FG", value: "12-21" },
                        { label: "3PT", value: "4-9" },
                        { label: "Minutes", value: "34" },
                      ]}
                    />
                  </div>
                </TeamSurface>
                <div className="flex flex-wrap items-end gap-4">
                  {sampleAccounts(team.id, team.name).map((account) =>
                    AVATAR_SIZES.map((size) => (
                      <AccountAvatar
                        key={`${account.key}:${size}`}
                        account={account}
                        context={SHOWCASE_CONTEXT}
                        size={size}
                      />
                    )),
                  )}
                </div>
                <p className="flex items-center gap-2 text-sm text-zinc-300">
                  Verified <VerifiedMark /> Unread <UnreadDot />
                </p>
              </div>
            );
          })}
        </section>

        <div className="mt-8">
          <TimelineLoadMore href="/dev/media-showcase?before=showcase" />
        </div>
      </div>
    </main>
  );
}
