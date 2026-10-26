import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FocusGrid } from "@/components/ui/focus/FocusGrid";
import { setInputMode } from "@/components/ui/focus/input-mode";

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  delete document.documentElement.dataset.input;
});

/** jsdom has no layout: give each tile a fixed box on a 2x2 grid. */
function placeTiles() {
  const positions: Record<string, [number, number]> = {
    A: [0, 0],
    B: [110, 0],
    C: [0, 110],
    D: [110, 110],
  };
  for (const [name, [left, top]] of Object.entries(positions)) {
    const link = screen.getByRole("link", { name });
    link.getBoundingClientRect = () =>
      ({
        left,
        top,
        right: left + 100,
        bottom: top + 100,
        width: 100,
        height: 100,
        x: left,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect;
    Object.defineProperty(link, "offsetParent", { value: document.body });
  }
}

function Board() {
  return (
    <FocusGrid memoryKey="test" aria-label="Tiles">
      {["A", "B", "C", "D"].map((name) => (
        <a key={name} href={`/${name}`} data-focus-item="">
          {name}
        </a>
      ))}
    </FocusGrid>
  );
}

describe("FocusGrid", () => {
  it("moves focus with arrow keys by position", () => {
    render(<Board />);
    placeTiles();
    const a = screen.getByRole("link", { name: "A" });
    a.focus();
    fireEvent.keyDown(a, { key: "ArrowRight" });
    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "B" }),
    );
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "D" }),
    );
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "D" }),
    );
  });

  it("leaves Tab order alone: every tile stays in the tab sequence", () => {
    render(<Board />);
    for (const name of ["A", "B", "C", "D"]) {
      expect(screen.getByRole("link", { name }).tabIndex).toBe(0);
    }
  });

  it("ignores arrows with a modifier held", () => {
    render(<Board />);
    placeTiles();
    const a = screen.getByRole("link", { name: "A" });
    a.focus();
    fireEvent.keyDown(a, { key: "ArrowRight", altKey: true });
    expect(document.activeElement).toBe(a);
  });

  it("restores the remembered tile only in keyboard mode", () => {
    const first = render(<Board />);
    screen.getByRole("link", { name: "C" }).focus();
    first.unmount();

    render(<Board />);
    expect(document.activeElement).toBe(document.body);
    cleanup();

    setInputMode("keyboard");
    render(<Board />);
    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "C" }),
    );
  });
});
