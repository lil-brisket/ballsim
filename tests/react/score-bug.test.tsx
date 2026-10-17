import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ScoreBug } from "@/components/ui/ScoreBug";

afterEach(cleanup);

const teams = [
  { abbreviation: "HAR", branding: null, score: 104 },
  { abbreviation: "SUM", branding: null, score: 98 },
] as const;

describe("ScoreBug", () => {
  it("exposes accessible final text with a short date", () => {
    render(<ScoreBug teams={teams} date="2026-10-08" />);
    expect(screen.getByText("Final: HAR 104, SUM 98, Oct 8")).toBeTruthy();
  });

  it("marks overtime", () => {
    render(<ScoreBug teams={teams} date="2026-10-08" overtime />);
    expect(screen.getByText("Final/OT: HAR 104, SUM 98, Oct 8")).toBeTruthy();
  });

  it("bolds only the winner", () => {
    const { container } = render(<ScoreBug teams={teams} date="2026-10-08" />);
    const visible = container.querySelector("[aria-hidden]")!;
    const bold = Array.from(visible.querySelectorAll("span")).filter((el) =>
      el.className.includes("font-extrabold"),
    );
    expect(bold.map((el) => el.textContent)).toEqual(["HAR", "104"]);
  });

  it("becomes a link with a 44px target when href is given", () => {
    render(
      <ScoreBug
        teams={teams}
        date="2026-10-08"
        href="/dashboard/s1/games/g1"
      />,
    );
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/dashboard/s1/games/g1");
    expect(link.className).toContain("min-h-11");
  });

  it("is not a link without href", () => {
    render(<ScoreBug teams={teams} date="2026-10-08" />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
