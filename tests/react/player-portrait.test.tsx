import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  PlayerPortrait,
  PORTRAIT_SIZE_PX,
} from "@/components/basketball/PlayerPortrait";
import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import { derivePortraitTraits } from "@/systems/portraits/assign-player-portraits";

function assignment(playerId = "player_1"): PlayerPortraitAssignment {
  return {
    version: 1,
    traits: derivePortraitTraits("save_ui", playerId, 0),
    salt: 0,
  };
}

function portrait(
  overrides: Partial<Parameters<typeof PlayerPortrait>[0]> = {},
) {
  return (
    <PlayerPortrait
      playerId="player_1"
      firstName="Alex"
      lastName="Rivera"
      size="lg"
      {...overrides}
    />
  );
}

describe("PlayerPortrait", () => {
  it("renders decorative initials and a reserved lg box", () => {
    const { container, unmount } = render(portrait());
    const root = container.querySelector(
      "[data-portrait-player-id='player_1']",
    );
    expect(root).toBeTruthy();
    expect(root?.getAttribute("aria-hidden")).toBe("true");
    expect(root?.getAttribute("data-portrait-size")).toBe("lg");
    expect(root?.getAttribute("data-portrait-state")).toBe("missing");
    expect((root as HTMLElement).style.width).toBe(`${PORTRAIT_SIZE_PX.lg}px`);
    expect((root as HTMLElement).style.height).toBe(`${PORTRAIT_SIZE_PX.lg}px`);
    expect(root?.className).toMatch(/h-24/);
    expect(root?.className).toMatch(/w-24/);
    expect(screen.getByText("AR")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
    unmount();
  });

  it("keeps initials in the accessible-hidden label for a slash composition", () => {
    const { unmount } = render(
      portrait({
        playerId: "player_slash_probe",
        firstName: "Leo",
        lastName: "Drake",
      }),
    );
    expect(screen.getByText("LD")).toBeTruthy();
    unmount();
  });

  it("keeps the same plate and composition for the same playerId", () => {
    const { container, rerender, unmount } = render(portrait());
    const first = container.querySelector("[data-portrait-plate]");
    const plate = first?.getAttribute("data-portrait-plate");
    const composition = first?.getAttribute("data-portrait-composition");
    rerender(portrait());
    const second = container.querySelector("[data-portrait-plate]");
    expect(second?.getAttribute("data-portrait-plate")).toBe(plate);
    expect(second?.getAttribute("data-portrait-composition")).toBe(composition);
    unmount();
  });

  it("ignores src unless state is ready", () => {
    const { container, unmount } = render(
      portrait({ state: "missing", src: "/portraits/x.webp" }),
    );
    expect(container.querySelector("img")).toBeNull();
    expect(
      container
        .querySelector("[data-portrait-player-id]")
        ?.getAttribute("data-portrait-state"),
    ).toBe("missing");
    unmount();
  });

  it("renders an overlay img only when state is ready and src is set", () => {
    const { container, unmount } = render(
      portrait({ state: "ready", src: "/portraits/x.webp" }),
    );
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toBe("/portraits/x.webp");
    expect(img?.getAttribute("alt")).toBe("");
    expect(img?.getAttribute("width")).toBe("96");
    expect(img?.getAttribute("height")).toBe("96");
    unmount();
  });

  it("treats ready without src as invalid and keeps the fallback box", () => {
    const { container, unmount } = render(portrait({ state: "ready" }));
    const root = container.querySelector("[data-portrait-player-id]");
    expect(root?.getAttribute("data-portrait-state")).toBe("invalid");
    expect(container.querySelector("img")).toBeNull();
    expect((root as HTMLElement).style.width).toBe("96px");
    unmount();
  });

  it("does not change dimensions for pending, failed, or invalid", () => {
    for (const state of ["pending", "failed", "invalid"] as const) {
      const { container, unmount } = render(portrait({ state, size: "sm" }));
      const root = container.querySelector("[data-portrait-player-id]");
      expect((root as HTMLElement).style.width).toBe("32px");
      expect((root as HTMLElement).style.height).toBe("32px");
      expect(root?.className).toMatch(/h-8/);
      expect(container.querySelector("[class*='animate-spin']")).toBeNull();
      unmount();
    }
  });

  it("uses exact pixel maps for xs md", () => {
    const xs = render(portrait({ size: "xs" }));
    const xsRoot = xs.container.querySelector("[data-portrait-size='xs']");
    expect((xsRoot as HTMLElement).style.width).toBe("24px");
    xs.unmount();
    const md = render(portrait({ size: "md" }));
    const mdRoot = md.container.querySelector("[data-portrait-size='md']");
    expect((mdRoot as HTMLElement).style.width).toBe("64px");
    md.unmount();
  });
  it("renders the persisted procedural face for a valid assignment", () => {
    const { container, unmount } = render(portrait({ portrait: assignment() }));
    const root = container.querySelector(
      "[data-portrait-player-id='player_1']",
    );
    expect(root?.getAttribute("data-portrait-state")).toBe("assigned");
    expect(container.querySelector("[data-portrait-face='true']")).toBeTruthy();
    expect(root?.textContent).not.toContain("AR");
    expect(container.querySelector("img")).toBeNull();
    expect((root as HTMLElement).style.width).toBe("96px");
    unmount();
  });

  it("renders identical faces for the same assignment and different faces otherwise", () => {
    const a = render(portrait({ portrait: assignment("player_a") }));
    const markupA = a.container.querySelector("svg")?.outerHTML;
    a.unmount();
    const again = render(portrait({ portrait: assignment("player_a") }));
    expect(again.container.querySelector("svg")?.outerHTML).toBe(markupA);
    again.unmount();
    const b = render(portrait({ portrait: assignment("player_b") }));
    expect(b.container.querySelector("svg")?.outerHTML).not.toBe(markupA);
    b.unmount();
  });

  it("falls back to initials for null or invalid assignments", () => {
    for (const bad of [
      null,
      {
        version: 1,
        traits: { skinTone: 99 },
        salt: 0,
      } as unknown as PlayerPortraitAssignment,
      {
        version: 7,
        traits: assignment().traits,
        salt: 0,
      } as unknown as PlayerPortraitAssignment,
    ]) {
      const { container, unmount } = render(portrait({ portrait: bad }));
      expect(container.querySelector("[data-portrait-face]")).toBeNull();
      expect(container.textContent).toContain("AR");
      expect(
        container
          .querySelector("[data-portrait-player-id]")
          ?.getAttribute("data-portrait-state"),
      ).toBe("missing");
      unmount();
    }
  });

  it("keeps honoring a ready raster overlay above the face", () => {
    const { container, unmount } = render(
      portrait({
        portrait: assignment(),
        state: "ready",
        src: "/portraits/x.webp",
      }),
    );
    expect(container.querySelector("[data-portrait-face='true']")).toBeTruthy();
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "/portraits/x.webp",
    );
    unmount();
  });

  it("never renders an img without a src", () => {
    const { container, unmount } = render(
      portrait({ portrait: assignment(), state: "ready", src: "" }),
    );
    expect(container.querySelector("img")).toBeNull();
    unmount();
  });
});
