import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SmokeLabel } from "./SmokeLabel";

describe("SmokeLabel", () => {
  it("renders the provided label in the DOM", () => {
    render(<SmokeLabel label="testing infrastructure ok" />);
    expect(screen.getByRole("status").textContent).toBe(
      "testing infrastructure ok",
    );
  });
});
