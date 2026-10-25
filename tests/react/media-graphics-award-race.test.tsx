import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { AwardRaceAttachmentCard } from "@/components/media-hub/timeline/AwardRaceAttachmentCard";
import type { TimelineDisplayContext } from "@/state/media-timeline/post-view";
import type {
  AwardRaceAttachment,
  TimelineTeamRef,
} from "@/state/media-timeline/types";

afterEach(cleanup);

const CONTEXT: TimelineDisplayContext = {
  saveId: "s1",
  teams: {},
  portraits: {},
};

function team(abbreviation: string): TimelineTeamRef {
  return {
    teamId: abbreviation.toLowerCase(),
    abbreviation,
    displayName: `${abbreviation} City`,
    name: abbreviation,
    branding: null,
  };
}

function race(
  overrides: Partial<AwardRaceAttachment> = {},
): AwardRaceAttachment {
  return {
    type: "award_race",
    awardId: "mvp",
    awardName: "Most Valuable Player",
    seasonYear: 2026,
    throughDate: "2026-01-11",
    contenders: [
      ["Ada", "Racer", "AAA"],
      ["Bo", "Chaser", "BBB"],
    ].map(([firstName, lastName, abbreviation], index) => ({
      rank: index + 1,
      player: {
        playerId: `p${index + 1}`,
        firstName: firstName!,
        lastName: lastName!,
        teamId: abbreviation!.toLowerCase(),
      },
      coachName: null,
      team: team(abbreviation!),
    })),
    previousLeaderName: null,
    ...overrides,
  };
}

describe("award race card", () => {
  it("lists contenders in rank order with links and team abbreviations", () => {
    render(<AwardRaceAttachmentCard attachment={race()} context={CONTEXT} />);
    expect(screen.getByText("Most Valuable Player race")).toBeTruthy();
    expect(screen.getByText(/through Jan 11/)).toBeTruthy();
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText("1")).toBeTruthy();
    const link = within(rows[0]!).getByRole("link", { name: "Ada Racer" });
    expect(link.getAttribute("href")).toBe("/dashboard/s1/players/p1");
    expect(within(rows[0]!).getByText("AAA")).toBeTruthy();
    expect(within(rows[1]!).getByText("BBB")).toBeTruthy();
  });

  it("names the previous leader only after a change", () => {
    const { rerender } = render(
      <AwardRaceAttachmentCard attachment={race()} context={CONTEXT} />,
    );
    expect(screen.queryByText(/Previous leader/)).toBeNull();
    rerender(
      <AwardRaceAttachmentCard
        attachment={race({ previousLeaderName: "Zed Old" })}
        context={CONTEXT}
      />,
    );
    expect(screen.getByText("Previous leader: Zed Old")).toBeTruthy();
  });
});
