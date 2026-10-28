import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/save_test/roster",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), refresh: () => {} }),
}));
vi.mock("@/components/entity/EntityDrawerProvider", () => ({
  useEntityDrawer: () => ({
    openPlayer: vi.fn(),
    openTeam: vi.fn(),
    openStaff: () => {},
    close: () => {},
  }),
}));

const bridgeMounted = vi.fn();
vi.mock("@/components/game/shell/GamepadBridge", () => ({
  GamepadBridge: () => {
    bridgeMounted();
    return null;
  },
}));

import { OWNER_NAV_GROUPS } from "@/application/owner-nav-config";
import { OPEN_COMMAND_PALETTE } from "@/components/game/shell/hub-keys";
import {
  LazyCommandPalette,
  LazyGamepadBridge,
} from "@/components/game/shell/LazyShellExtras";
import { resetSearchIndexCacheForTests } from "@/components/game/shell/CommandPalette";
import { resetDrawerScrollLockForTests } from "@/components/ui/drawer-scroll-lock";
import { LazyDashboardMoments } from "@/components/moments/LazyDashboardMoments";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  bridgeMounted.mockClear();
  resetSearchIndexCacheForTests();
  resetDrawerScrollLockForTests();
});

describe("LazyCommandPalette", () => {
  it("renders nothing until the first open request, then opens", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ players: [], teams: [] }), {
            status: 200,
          }),
      ),
    );
    render(<LazyCommandPalette saveId="save_test" groups={OWNER_NAV_GROUPS} />);
    expect(screen.queryByRole("dialog")).toBeNull();

    await act(async () => {
      window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE));
    });
    expect(await screen.findByRole("combobox")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

describe("LazyGamepadBridge", () => {
  it("does not load the bridge without a controller", async () => {
    vi.stubGlobal("navigator", { ...navigator, getGamepads: () => [] });
    render(<LazyGamepadBridge />);
    await act(async () => {});
    expect(bridgeMounted).not.toHaveBeenCalled();
  });

  it("loads the bridge when a controller connects", async () => {
    vi.stubGlobal("navigator", { ...navigator, getGamepads: () => [] });
    render(<LazyGamepadBridge />);
    await act(async () => {
      window.dispatchEvent(new Event("gamepadconnected"));
    });
    await vi.waitFor(() => expect(bridgeMounted).toHaveBeenCalled());
  });
});

describe("LazyDashboardMoments", () => {
  it("renders nothing when the save has no moment to show", () => {
    const { container } = render(
      <LazyDashboardMoments
        saveId="save_test"
        moments={{
          teamId: "t1",
          awards: null,
          champion: null,
          recap: null,
          progression: null,
        }}
      />,
    );
    expect(container.innerHTML).toBe("");
  });
});
