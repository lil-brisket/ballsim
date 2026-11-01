import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  PlayerPortrait,
  PORTRAIT_SIZE_PX,
} from "@/components/basketball/PlayerPortrait";
import { uniformColors } from "@/components/basketball/PortraitFace";
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
    expect(root?.getAttribute("data-portrait-source")).toBe("initials");
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
    expect(root?.getAttribute("data-portrait-source")).toBe("face");
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
          ?.getAttribute("data-portrait-source"),
      ).toBe("initials");
      unmount();
    }
  });

  describe("shared library image", () => {
    const withLibrary = (id = "p0001") => ({
      ...assignment(),
      libraryId: id,
    });
    const jerseyLayer = (container: HTMLElement) =>
      container.querySelector<HTMLElement>("span[style*='multiply']");

    it("renders the library image instead of the procedural face", () => {
      const { container, unmount } = render(
        portrait({ portrait: withLibrary() }),
      );
      const root = container.querySelector("[data-portrait-player-id]");
      expect(root?.getAttribute("data-portrait-source")).toBe("library");
      expect(container.querySelector("[data-portrait-face]")).toBeNull();
      const img = container.querySelector("img");
      expect(img?.getAttribute("src")).toBe(
        "/portraits/library/256/p0001.webp",
      );
      expect(img?.getAttribute("alt")).toBe("");
      expect(img?.getAttribute("width")).toBe("96");
      unmount();
    });

    it("lazy-loads with size-appropriate sources", () => {
      const { container, unmount } = render(
        portrait({ portrait: withLibrary(), size: "sm" }),
      );
      const img = container.querySelector("img")!;
      expect(img.getAttribute("loading")).toBe("lazy");
      expect(img.getAttribute("decoding")).toBe("async");
      expect(img.getAttribute("sizes")).toBe("32px");
      expect(img.getAttribute("srcset")).toBe(
        "/portraits/library/128/p0001.webp 128w, /portraits/library/256/p0001.webp 256w, /portraits/library/512/p0001.webp 512w",
      );
      unmount();
    });

    it("multiplies the team colour into the jersey through the mask only", () => {
      const { container, rerender } = render(
        portrait({ portrait: withLibrary() }),
      );
      expect(jerseyLayer(container)?.style.backgroundColor).toBe(
        "rgb(63, 63, 70)",
      );
      expect(container.querySelector("[data-portrait-uniform]")).toBeNull();
      rerender(
        portrait({
          portrait: withLibrary(),
          uniform: { primaryColor: "#0B1F3A", secondaryColor: "#C4CED4" },
        }),
      );
      const layer = jerseyLayer(container)!;
      expect(layer.style.backgroundColor).toBe("rgb(11, 31, 58)");
      expect(layer.getAttribute("style")).toContain(
        "/portraits/library/mask/p0001.webp",
      );
      expect(
        container
          .querySelector("[data-portrait-uniform]")
          ?.getAttribute("data-portrait-uniform"),
      ).toBe("team");
    });

    it("falls back to the procedural face when there is no library id", () => {
      const { container, unmount } = render(
        portrait({ portrait: assignment() }),
      );
      expect(container.querySelector("img")).toBeNull();
      expect(container.querySelector("[data-portrait-face]")).toBeTruthy();
      unmount();
    });
  });

  it("dresses the face in team colours only when a uniform is given", () => {
    const { container, rerender } = render(
      portrait({ portrait: assignment() }),
    );
    const svg = () =>
      container.querySelector("[data-portrait-face]")!.innerHTML;
    expect(svg()).toContain("#3f3f46");
    expect(container.querySelector("[data-portrait-uniform]")).toBeNull();
    rerender(
      portrait({
        portrait: assignment(),
        uniform: { primaryColor: "#0B1F3A", secondaryColor: "#C4CED4" },
      }),
    );
    expect(svg()).toContain("#0B1F3A");
    expect(svg()).toContain("#C4CED4");
    expect(svg()).not.toContain("#d97706");
  });

  it("keeps the collar visible when the team colours are too close", () => {
    expect(
      uniformColors({ primaryColor: "#FFFFFF", secondaryColor: "#F4F4F5" }),
    ).toEqual({ jersey: "#FFFFFF", trim: "#0A0A0A" });
    expect(
      uniformColors({ primaryColor: "#0B1F3A", secondaryColor: "#0F2340" }),
    ).toEqual({ jersey: "#0B1F3A", trim: "#FFFFFF" });
    expect(uniformColors(null)).toEqual({ jersey: "#3f3f46", trim: "#d97706" });
  });

  it("tints the initials plate with the team colour that shows on it", () => {
    const { container } = render(
      portrait({
        uniform: { primaryColor: "#0B1F3A", secondaryColor: "#C4CED4" },
      }),
    );
    const plate = container.querySelector("[data-portrait-plate]")!.innerHTML;
    expect(plate).toContain("#C4CED4");
    expect(plate).not.toContain("#d97706");
  });
});
