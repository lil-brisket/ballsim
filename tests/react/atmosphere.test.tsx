import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/save_test",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { ArenaPanel } from "@/components/ui/ArenaPanel";

const branding = {
  primaryColor: "#FFFFFF",
  secondaryColor: "#000000",
  accentColor: "#F5B800",
  logoId: "shield",
};

afterEach(cleanup);

describe("atmosphere", () => {
  it("ArenaPanel applies the hardwood class only when texture is set", () => {
    const { container } = render(
      <>
        <ArenaPanel>plain</ArenaPanel>
        <ArenaPanel texture>textured</ArenaPanel>
      </>,
    );
    const [plain, textured] = Array.from(container.querySelectorAll("section"));
    expect(plain.className).not.toContain("surface-hardwood");
    expect(textured.className).toContain("surface-hardwood");
  });

  it("ArenaPanel renders the watermark aria-hidden and only when asked", () => {
    const { container, rerender } = render(<ArenaPanel>x</ArenaPanel>);
    expect(container.querySelector(".panel-watermark")).toBeNull();
    rerender(<ArenaPanel watermark={branding}>x</ArenaPanel>);
    const mark = container.querySelector(".panel-watermark");
    expect(mark?.getAttribute("aria-hidden")).toBe("true");
    expect(mark?.querySelector("svg")).toBeTruthy();
  });
});
