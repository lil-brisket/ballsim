// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MoodChip } from "@/components/basketball/MoodChip";
import type { PlayerMoodView } from "@/state/player-mood-selectors";

function mood(overrides: Partial<PlayerMoodView>): PlayerMoodView {
  return {
    value: 60,
    band: "content",
    label: "Content",
    reason: "Settled",
    tradeRequested: false,
    ...overrides,
  };
}

describe("MoodChip", () => {
  it.each([
    ["happy", "Happy", "success"],
    ["content", "Content", "text-muted"],
    ["unhappy", "Unhappy", "warning"],
    ["upset", "Upset", "danger"],
  ] as const)("renders %s band with tone", (band, label, toneToken) => {
    render(<MoodChip mood={mood({ band, label })} />);
    const badge = screen.getByText(label);
    expect(badge.className).toContain(toneToken);
  });

  it("exposes label and reason as aria label and title", () => {
    render(
      <MoodChip
        mood={mood({
          band: "unhappy",
          label: "Unhappy",
          reason: "Wants more minutes",
        })}
      />,
    );
    const group = screen.getByLabelText("Unhappy: Wants more minutes");
    expect(group.getAttribute("title")).toBe("Unhappy: Wants more minutes");
  });

  it("shows trade request badge only when requested", () => {
    const { rerender } = render(<MoodChip mood={mood({})} />);
    expect(screen.queryByText("Trade request")).toBeNull();
    rerender(<MoodChip mood={mood({ tradeRequested: true })} />);
    expect(screen.getByText("Trade request")).toBeTruthy();
  });
});
