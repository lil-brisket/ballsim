import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RatingDisplaySetting } from "@/components/settings/RatingDisplaySetting";

describe("RatingDisplaySetting", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("starts on grades and switches every rating to numbers", () => {
    render(<RatingDisplaySetting />);
    expect(screen.getByText(/now showing grades/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Ratings" }));

    expect(screen.getByText(/now showing ratings/i)).toBeTruthy();
    expect(window.localStorage.getItem("ballsim:rating-display")).toBe(
      "ratings",
    );
  });
});
