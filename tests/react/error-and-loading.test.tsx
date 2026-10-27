import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const nav = vi.hoisted(() => ({ pathname: "/dashboard/s1" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
}));

import DashboardError from "@/app/dashboard/[saveId]/error";
import AppError from "@/app/error";
import GlobalError from "@/app/global-error";
import { backTarget } from "@/components/game/save-error-target";
import {
  SkeletonCards,
  SkeletonPage,
  SkeletonScreen,
  SkeletonTable,
  SkeletonTileBoard,
} from "@/components/ui/Skeleton";
import DashboardLoading from "@/app/dashboard/[saveId]/loading";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function failure(message = "boom", digest?: string) {
  return Object.assign(new Error(message), digest ? { digest } : {});
}

describe("dashboard error boundary", () => {
  it("renders the heading, focuses it and calls retry", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const retry = vi.fn();
    nav.pathname = "/dashboard/s1/roster";
    render(<DashboardError error={failure()} retry={retry} />);
    const heading = screen.getByRole("heading", {
      name: "Something went wrong",
    });
    expect(document.activeElement).toBe(heading);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["/dashboard/s1", "Back to Home", "/dashboard/s1"],
    ["/dashboard/s1/roster", "Back to Team", "/dashboard/s1/team"],
    [
      "/dashboard/s1/league/standings",
      "Back to League",
      "/dashboard/s1/league",
    ],
    ["/dashboard/s1/trades", "Back to Front Office", "/dashboard/s1/finances"],
    ["/dashboard/s1/players/p9", "Back to Team", "/dashboard/s1/team"],
    ["/dashboard/s1/nowhere", "Back to Home", "/dashboard/s1"],
  ])("resolves %s", (pathname, label, href) => {
    expect(backTarget(pathname)).toEqual({ label, href });
  });

  it("links back to the hub of the current page", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    nav.pathname = "/dashboard/s1/league/standings";
    render(<DashboardError error={failure()} retry={vi.fn()} />);
    expect(
      screen.getByRole("link", { name: "Back to League" }).getAttribute("href"),
    ).toBe("/dashboard/s1/league");
  });

  it("shows the digest and hides the message in production", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");
    nav.pathname = "/dashboard/s1";
    render(
      <DashboardError
        error={failure("secret detail", "abc123")}
        retry={vi.fn()}
      />,
    );
    expect(screen.getByText("Error reference: abc123")).toBeTruthy();
    expect(screen.queryByText(/secret detail/)).toBeNull();
  });

  it("shows the message outside production", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "development");
    nav.pathname = "/dashboard/s1";
    render(<DashboardError error={failure("secret detail")} retry={vi.fn()} />);
    expect(screen.getByText(/secret detail/)).toBeTruthy();
  });
});

describe("app and global error boundaries", () => {
  it("app error retries and links to the BallSim home", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const retry = vi.fn();
    render(<AppError error={failure("x", "d1")} retry={retry} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(
      screen
        .getByRole("link", { name: "Back to BallSim home" })
        .getAttribute("href"),
    ).toBe("/home");
    expect(screen.getByText("Error reference: d1")).toBeTruthy();
  });

  it("global error renders its own document, retries and shows the digest", () => {
    const retry = vi.fn();
    // global-error renders <html>, so mount it on the document element.
    const error = failure("x", "g1");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(<GlobalError error={error} retry={retry} />, {
      container: document.documentElement,
    });
    expect(container.textContent).toContain("Something went wrong");
    expect(container.textContent).toContain("Error reference: g1");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(
      screen
        .getByRole("link", { name: "Back to BallSim home" })
        .getAttribute("href"),
    ).toBe("/home");
  });
});

describe("skeletons", () => {
  it("expose one status and hide the placeholders", () => {
    const { container } = render(<DashboardLoading />);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toBe("Loading…");
    const blocks = container.querySelectorAll("[data-skeleton]");
    expect(blocks.length).toBeGreaterThan(8);
    for (const block of blocks) {
      expect(block.closest("[aria-hidden='true']")).not.toBeNull();
    }
  });

  it("each composite is aria-hidden on its own", () => {
    for (const piece of [
      <SkeletonTileBoard key="a" />,
      <SkeletonTable key="b" />,
      <SkeletonCards key="c" />,
      <SkeletonPage key="d" />,
    ]) {
      const { container, unmount } = render(
        <SkeletonScreen>{piece}</SkeletonScreen>,
      );
      expect(container.querySelectorAll("[role='status']")).toHaveLength(1);
      unmount();
    }
  });

  it("the shimmer is switched off under reduced motion", () => {
    const css = readFileSync(
      path.join(process.cwd(), "src", "app", "globals.css"),
      "utf8",
    );
    expect(css).toMatch(/\.skeleton\s*\{[^}]*animation:\s*skeleton-shimmer/);
    const reduced = css
      .split("@media (prefers-reduced-motion: reduce)")
      .filter((chunk) => /^\s*\{\s*\.skeleton\s*\{/.test(chunk));
    expect(reduced).toHaveLength(1);
    expect(reduced[0]).toMatch(/animation:\s*none/);
  });
});
