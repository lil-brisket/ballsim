import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import BroadcastUiShowcasePage from "@/app/dev/broadcast-ui/page";

afterEach(cleanup);

describe("broadcast-ui showcase page", () => {
  it("renders each key primitive once per team", () => {
    render(<BroadcastUiShowcasePage />);
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    expect(screen.getAllByRole("spinbutton")).toHaveLength(2);
    expect(
      screen.getAllByRole("navigation", { name: /Link tabs/ }),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole("navigation", { name: /Button tabs/ }),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole("button", { name: "Disabled primary" }),
    ).toHaveLength(2);
    expect(screen.getAllByText("Final/OT")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /Open drawer/ })).toHaveLength(
      2,
    );
  });
});
