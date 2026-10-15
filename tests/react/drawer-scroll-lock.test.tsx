import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Drawer } from "@/components/ui/Drawer";
import {
  acquireDrawerScrollLock,
  getDrawerScrollLockCountForTests,
  releaseDrawerScrollLock,
  resetDrawerScrollLockForTests,
} from "@/components/ui/drawer-scroll-lock";

describe("drawer scroll lock", () => {
  beforeEach(() => {
    resetDrawerScrollLockForTests();
    document.body.style.overflow = "visible";
    document.body.style.paddingRight = "3px";
  });

  afterEach(() => {
    resetDrawerScrollLockForTests();
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
  });

  it("restores the original overflow and padding on last release", () => {
    acquireDrawerScrollLock();
    expect(document.body.style.overflow).toBe("hidden");
    expect(getDrawerScrollLockCountForTests()).toBe(1);

    acquireDrawerScrollLock();
    expect(document.body.style.overflow).toBe("hidden");
    expect(getDrawerScrollLockCountForTests()).toBe(2);

    releaseDrawerScrollLock();
    expect(document.body.style.overflow).toBe("hidden");
    expect(getDrawerScrollLockCountForTests()).toBe(1);

    releaseDrawerScrollLock();
    expect(document.body.style.overflow).toBe("visible");
    expect(document.body.style.paddingRight).toBe("3px");
    expect(getDrawerScrollLockCountForTests()).toBe(0);
  });
});

describe("Drawer layout", () => {
  beforeEach(() => {
    resetDrawerScrollLockForTests();
  });

  afterEach(() => {
    resetDrawerScrollLockForTests();
  });

  it("always renders as a centered modal", () => {
    const { unmount } = render(
      <Drawer open onOpenChange={() => undefined} title="Player" size="xl">
        Body
      </Drawer>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("data-drawer-placement")).toBe("modal");
    expect(dialog.className).not.toMatch(/sm:border-l/);
    expect(dialog.className).not.toMatch(/max-w-md/);
    expect(dialog.className).toMatch(/max-w-5xl/);
    expect(dialog.parentElement?.className).not.toMatch(/sm:justify-end/);
    fireEvent.keyDown(document, { key: "Escape" });
    unmount();
  });
});
