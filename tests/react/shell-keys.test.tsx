import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";

const push = vi.fn();
let pathname = "/dashboard/save_test/roster";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push }),
}));

import { OWNER_NAV_GROUPS } from "@/application/owner-nav-config";
import {
  OPEN_COMMAND_PALETTE,
  simHref,
} from "@/components/game/shell/hub-keys";
import { ShellKeys } from "@/components/game/shell/ShellKeys";
import { SimulationActivityProvider } from "@/components/game/simulation-activity";

function renderKeys(path: string) {
  pathname = path;
  return render(
    <SimulationActivityProvider>
      <ShellKeys saveId="save_test" groups={OWNER_NAV_GROUPS} />
      <input aria-label="Filter" />
      <button type="button">Focusable</button>
      <div data-testid="popup-host" />
    </SimulationActivityProvider>,
  );
}

beforeEach(() => {
  push.mockReset();
});

afterEach(() => {
  cleanup();
  document.body.focus();
});

describe("ShellKeys", () => {
  it("steps hubs with E and Q, the same hrefs as the hub links", () => {
    renderKeys("/dashboard/save_test/roster");
    fireEvent.keyDown(window, { key: "e" });
    expect(push).toHaveBeenLastCalledWith("/dashboard/save_test/league", {
      transitionTypes: ["hub-forward"],
    });
    fireEvent.keyDown(window, { key: "q" });
    expect(push).toHaveBeenLastCalledWith("/dashboard/save_test", {
      transitionTypes: ["hub-back"],
    });
  });

  it("slides by hub order for number keys, and Settings is after the last hub", () => {
    renderKeys("/dashboard/save_test/league");
    fireEvent.keyDown(window, { key: "2" });
    expect(push).toHaveBeenLastCalledWith("/dashboard/save_test/team", {
      transitionTypes: ["hub-back"],
    });
    fireEvent.keyDown(window, { key: "4" });
    expect(push).toHaveBeenLastCalledWith("/dashboard/save_test/finances", {
      transitionTypes: ["hub-forward"],
    });
    cleanup();
    renderKeys("/dashboard/save_test/settings");
    fireEvent.keyDown(window, { key: "1" });
    expect(push).toHaveBeenLastCalledWith("/dashboard/save_test", {
      transitionTypes: ["hub-back"],
    });
  });

  it("goes up a level with Esc: tab to hub, hub to Home", () => {
    renderKeys("/dashboard/save_test/roster");
    fireEvent.keyDown(window, { key: "Escape" });
    // Same hub: no slide type, the page crossfades.
    expect(push).toHaveBeenLastCalledWith("/dashboard/save_test/team");
    cleanup();
    renderKeys("/dashboard/save_test/team");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(push).toHaveBeenLastCalledWith("/dashboard/save_test", {
      transitionTypes: ["hub-back"],
    });
  });

  it("leaves Esc to an open menu", () => {
    const { getByTestId } = renderKeys("/dashboard/save_test/roster");
    getByTestId("popup-host").setAttribute("aria-expanded", "true");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(push).not.toHaveBeenCalled();
  });

  it("Space opens Sim like the Sim button, only when nothing is focused", () => {
    const { getByRole } = renderKeys("/dashboard/save_test");
    fireEvent.keyDown(window, { key: " " });
    expect(push).toHaveBeenLastCalledWith(simHref("save_test"));
    push.mockReset();
    getByRole("button", { name: "Focusable" }).focus();
    fireEvent.keyDown(getByRole("button", { name: "Focusable" }), {
      key: " ",
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("opens search with / and Ctrl+K", () => {
    renderKeys("/dashboard/save_test");
    const opened = vi.fn();
    window.addEventListener(OPEN_COMMAND_PALETTE, opened);
    fireEvent.keyDown(window, { key: "/" });
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    window.removeEventListener(OPEN_COMMAND_PALETTE, opened);
    expect(opened).toHaveBeenCalledTimes(2);
  });

  it("never fires while typing in a field", () => {
    const { getByRole } = renderKeys("/dashboard/save_test/roster");
    const input = getByRole("textbox", { name: "Filter" });
    input.focus();
    for (const key of ["e", "q", "1", "Escape", " ", "/"]) {
      fireEvent.keyDown(input, { key });
    }
    expect(push).not.toHaveBeenCalled();
  });
});
