import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/save_test/players/compare",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: () => {} }),
}));

import { CategoryBoxes } from "@/components/basketball/PlayerBoxes";
import { PlayerCompareBoard } from "@/components/player-compare/PlayerCompareBoard";
import { RatingDisplaySwitch } from "@/components/ui/RatingDisplaySwitch";
import {
  RATING_DISPLAY_STORAGE_KEY,
  setRatingDisplay,
} from "@/components/ui/rating-display";
import type { PlayerAttributes } from "@/domain/entities/player";
import { categoryRatings } from "@/presentation/player-rating-categories";
import { formatRating } from "@/presentation/rating-grade";
import type { PlayerCompareView } from "@/state/player-compare";

function attributes(value: number): PlayerAttributes {
  return {
    speed: value,
    strength: value,
    athleticism: value,
    stamina: value,
    finishing: value,
    midRange: value,
    threePoint: value,
    freeThrow: value,
    ballHandling: value,
    passing: value,
    perimeterDefense: value,
    interiorDefense: value,
    steal: value,
    block: value,
    rebounding: value,
    basketballIq: value,
    offensiveIq: value,
    defensiveIq: value,
    consistency: value,
  };
}

/** Inside 96 (best), outside 50 (weakest), playmaking 80, the rest 60. */
const MIXED: PlayerAttributes = {
  ...attributes(60),
  finishing: 96,
  midRange: 50,
  threePoint: 50,
  freeThrow: 50,
  ballHandling: 82,
  passing: 78,
};

function boxes() {
  const list = screen.getByRole("list", { name: "Category ratings" });
  return Array.from(
    list.querySelectorAll<HTMLElement>(":scope > li[data-category]"),
  );
}

function bigValue(box: HTMLElement) {
  return box.querySelector<HTMLElement>(".font-display > [aria-hidden]")!;
}

function compareView(
  id: string,
  lastName: string,
  overall: number,
  attr: number,
): PlayerCompareView {
  return {
    playerId: id,
    firstName: "Test",
    lastName,
    position: "PG",
    age: 25,
    heightInches: 79,
    archetypeLabel: "Floor General",
    overall,
    teamAbbreviation: "HAR",
    contract: null,
    attributes: attributes(attr),
  };
}

afterEach(() => {
  cleanup();
  setRatingDisplay("grades");
});

describe("CategoryBoxes", () => {
  it("renders one box per category with its label and grade", () => {
    render(<CategoryBoxes attributes={MIXED} />);
    const expected = categoryRatings(MIXED);
    const found = boxes();
    expect(found).toHaveLength(7);
    found.forEach((box, i) => {
      const category = expected[i]!;
      expect(box.getAttribute("data-category")).toBe(category.key);
      expect(within(box).getByText(category.label)).toBeTruthy();
      expect(bigValue(box).textContent).toBe(
        formatRating(category.rating, "grades").text,
      );
    });
  });

  it("tags the best and weakest category with text, and nothing when all are equal", () => {
    const { unmount } = render(<CategoryBoxes attributes={MIXED} />);
    const inside = boxes().find(
      (b) => b.getAttribute("data-category") === "insideScoring",
    )!;
    const outside = boxes().find(
      (b) => b.getAttribute("data-category") === "outsideScoring",
    )!;
    expect(within(inside).getByText("Best")).toBeTruthy();
    expect(within(inside).getByText("Best category")).toBeTruthy();
    expect(within(outside).getByText("Weakest")).toBeTruthy();
    expect(within(outside).getByText("Weakest category")).toBeTruthy();
    expect(boxes().filter((b) => b.hasAttribute("data-emphasis"))).toHaveLength(
      2,
    );
    unmount();

    render(<CategoryBoxes attributes={attributes(70)} />);
    expect(screen.queryByText("Best")).toBeNull();
    expect(screen.queryByText("Weakest")).toBeNull();
    expect(screen.queryByText("Best category")).toBeNull();
  });

  it("switches every box between letters and numbers, keeping the number for screen readers", () => {
    render(<CategoryBoxes attributes={MIXED} />);
    const expected = categoryRatings(MIXED);
    fireEvent.click(screen.getByRole("button", { name: "Ratings" }));
    boxes().forEach((box, i) => {
      expect(bigValue(box).textContent).toBe(String(expected[i]!.rating));
    });
    fireEvent.click(screen.getByRole("button", { name: "Grades" }));
    boxes().forEach((box, i) => {
      expect(bigValue(box).textContent).toBe(
        formatRating(expected[i]!.rating, "grades").text,
      );
      // Grades still speak the number.
      expect(box.textContent).toContain(String(expected[i]!.rating));
    });
  });

  it("colours each box by the band of the letter it shows", () => {
    render(<CategoryBoxes attributes={MIXED} />);
    const expected = categoryRatings(MIXED);
    boxes().forEach((box, i) => {
      const letter = bigValue(box).textContent!;
      const band = formatRating(expected[i]!.rating, "grades").band;
      expect(formatRating(expected[i]!.rating, "grades").grade).toBe(letter);
      expect(box.getAttribute("data-tier")).toBe(band);
    });
    // Same band in ratings mode, so letter and colour never disagree.
    fireEvent.click(screen.getByRole("button", { name: "Ratings" }));
    boxes().forEach((box, i) => {
      expect(box.getAttribute("data-tier")).toBe(
        formatRating(expected[i]!.rating, "grades").band,
      );
    });
  });

  it("starts with the best category open and toggles sub-ratings that follow the mode", () => {
    render(<CategoryBoxes attributes={MIXED} />);
    const inside = boxes().find(
      (b) => b.getAttribute("data-category") === "insideScoring",
    )!;
    const playmaking = boxes().find(
      (b) => b.getAttribute("data-category") === "playmaking",
    )!;
    expect(
      within(inside)
        .getByRole("button", { name: /Hide details/ })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    expect(within(inside).getByText("Finishing")).toBeTruthy();
    expect(within(playmaking).queryByText("Ball Handling")).toBeNull();

    const toggle = within(playmaking).getByRole("button", {
      name: /Details for Playmaking/,
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const subs = within(playmaking).getByRole("list", {
      name: "Playmaking attributes",
    });
    expect(within(subs).getByText("Ball Handling")).toBeTruthy();
    expect(subs.textContent).toContain("B+");

    fireEvent.click(screen.getByRole("button", { name: "Ratings" }));
    const items = Array.from(subs.querySelectorAll("li")).map(
      (li) => li.querySelector("[aria-hidden]")?.textContent,
    );
    expect(items).toEqual(["82", "78"]);

    fireEvent.click(toggle);
    expect(within(playmaking).queryByText("Ball Handling")).toBeNull();
  });

  it("non-interactive boxes have no toggle and no sub-ratings", () => {
    render(<CategoryBoxes attributes={MIXED} interactive={false} />);
    expect(boxes()).toHaveLength(7);
    expect(screen.queryByRole("button", { name: /details/i })).toBeNull();
    expect(screen.queryByText("Finishing")).toBeNull();
    // The display switch is still there so the profile can switch too.
    expect(screen.getByRole("group", { name: "Rating display" })).toBeTruthy();
  });
});

describe("PlayerCompareBoard rating display", () => {
  function renderBoard() {
    render(
      <PlayerCompareBoard
        saveId="save_test"
        a={compareView("p1", "Alpha", 70, 60)}
        b={compareView("p2", "Bravo", 75, 82)}
      />,
    );
    const table = screen.getByRole("table");
    return {
      overall: within(table).getByRole("row", { name: /^Overall/ }),
      group: within(table).getByRole("row", { name: /^Defense/ }),
      attribute: within(table).getByRole("row", { name: /^Finishing/ }),
    };
  }

  const visible = (row: HTMLElement) =>
    Array.from(row.querySelectorAll("td [aria-hidden]")).map(
      (el) => el.textContent,
    );

  it("shows letters for group and attribute rows, with a numeric overall and diff", () => {
    const rows = renderBoard();
    expect(visible(rows.group)).toEqual(["C-", "B+"]);
    expect(visible(rows.attribute)).toEqual(["C-", "B+"]);
    expect(within(rows.overall).getByText("70")).toBeTruthy();
    expect(within(rows.overall).getByText("75")).toBeTruthy();
    expect(within(rows.group).getByText("+22")).toBeTruthy();
    expect(within(rows.overall).getByText("+5")).toBeTruthy();
  });

  it("shows numbers in ratings mode and leaves the overall row and diff alone", () => {
    setRatingDisplay("ratings");
    const rows = renderBoard();
    expect(visible(rows.group)).toEqual(["60", "82"]);
    expect(visible(rows.attribute)).toEqual(["60", "82"]);
    expect(within(rows.overall).getByText("70")).toBeTruthy();
    expect(within(rows.group).getByText("+22")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Rating display" })).toBeTruthy();
    expect(screen.getAllByRole("rowheader").length).toBeGreaterThan(0);
  });
});

describe("RatingDisplaySwitch", () => {
  it("persists the choice through the shared preference and keeps instances in sync", () => {
    render(
      <>
        <RatingDisplaySwitch />
        <CategoryBoxes attributes={MIXED} />
      </>,
    );
    const [first] = screen.getAllByRole("group", { name: "Rating display" });
    fireEvent.click(within(first!).getByRole("button", { name: "Ratings" }));
    expect(window.localStorage.getItem(RATING_DISPLAY_STORAGE_KEY)).toBe(
      "ratings",
    );
    for (const group of screen.getAllByRole("group", {
      name: "Rating display",
    })) {
      expect(
        within(group)
          .getByRole("button", { name: "Ratings" })
          .getAttribute("aria-pressed"),
      ).toBe("true");
    }
    expect(bigValue(boxes()[0]!).textContent).toMatch(/^\d+$/);
  });
});
