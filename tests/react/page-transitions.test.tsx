import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

let pathname = "/dashboard/save_test/team";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: () => {} }),
}));

// Expose Link's transitionTypes in the DOM so the tests can read them.
vi.mock("next/link", () => ({
  default: (props: {
    href: string;
    transitionTypes?: string[];
    children?: React.ReactNode;
    className?: string;
  }) => (
    <a
      href={props.href}
      className={props.className}
      data-transition-types={props.transitionTypes?.join(",") ?? ""}
    >
      {props.children}
    </a>
  ),
}));

import { OWNER_NAV_GROUPS } from "@/application/owner-nav-config";
import { RouteTransition } from "@/components/game/RouteTransition";
import { HubBar } from "@/components/game/shell/HubBar";
import { MobileHubBar } from "@/components/game/shell/MobileHubBar";
import { SubTabBar } from "@/components/game/shell/SubTabBar";

function typesFor(container: HTMLElement, href: string): string | null {
  return container
    .querySelector(`a[href="${href}"]`)
    ?.getAttribute("data-transition-types") as string | null;
}

beforeEach(() => {
  pathname = "/dashboard/save_test/team";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("hub link transition types", () => {
  it("HubBar tags later hubs forward and earlier hubs back", () => {
    const { container } = render(
      <HubBar saveId="save_test" groups={OWNER_NAV_GROUPS} />,
    );
    const base = "/dashboard/save_test";
    expect(typesFor(container, `${base}`)).toBe("hub-back");
    expect(typesFor(container, `${base}/league`)).toBe("hub-forward");
    expect(typesFor(container, `${base}/media`)).toBe("hub-forward");
    expect(typesFor(container, `${base}/settings`)).toBe("hub-forward");
    // The current hub crossfades.
    expect(typesFor(container, `${base}/team`)).toBe("");
  });

  it("MobileHubBar uses the same directions", () => {
    pathname = "/dashboard/save_test/league";
    const { container } = render(
      <MobileHubBar saveId="save_test" groups={OWNER_NAV_GROUPS} />,
    );
    const base = "/dashboard/save_test";
    expect(typesFor(container, `${base}/team`)).toBe("hub-back");
    expect(typesFor(container, `${base}/finances`)).toBe("hub-forward");
    expect(typesFor(container, `${base}/league`)).toBe("");
  });

  it("sub-tab links carry no slide type (they crossfade)", () => {
    const { container } = render(
      <SubTabBar saveId="save_test" groups={OWNER_NAV_GROUPS} />,
    );
    const tabs = container.querySelectorAll("a[data-transition-types]");
    expect(tabs.length).toBeGreaterThan(1);
    for (const tab of tabs) {
      expect(tab.getAttribute("data-transition-types")).toBe("");
    }
  });
});

describe("RouteTransition fallback", () => {
  function setup(options: { reduced: boolean; viewTransitions: boolean }) {
    const animate = vi.fn();
    HTMLElement.prototype.animate = animate as never;
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({
          matches: options.reduced && query.includes("reduce"),
        }) as MediaQueryList,
    );
    if (options.viewTransitions) {
      (document as unknown as Record<string, unknown>).startViewTransition =
        () => {};
    } else {
      delete (document as unknown as Record<string, unknown>)
        .startViewTransition;
    }
    const view = render(
      <RouteTransition>
        <p>page</p>
      </RouteTransition>,
    );
    pathname = "/dashboard/save_test/league";
    view.rerender(
      <RouteTransition>
        <p>page</p>
      </RouteTransition>,
    );
    return animate;
  }

  afterEach(() => {
    delete (document as unknown as Record<string, unknown>).startViewTransition;
  });

  it("fades with a Web Animation only when View Transitions are missing", () => {
    expect(
      setup({ reduced: false, viewTransitions: false }),
    ).toHaveBeenCalled();
  });

  it("does not double-animate where View Transitions exist", () => {
    expect(
      setup({ reduced: false, viewTransitions: true }),
    ).not.toHaveBeenCalled();
  });

  it("does nothing under reduced motion", () => {
    expect(
      setup({ reduced: true, viewTransitions: false }),
    ).not.toHaveBeenCalled();
  });
});

describe("page transition CSS", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  const section = css.slice(css.indexOf("Page transitions"));

  it("defines the slide and crossfade classes", () => {
    for (const name of ["hub-forward", "hub-back", "page-fade"]) {
      expect(section).toContain(`::view-transition-old(.${name})`);
      expect(section).toContain(`::view-transition-new(.${name})`);
    }
  });

  it("switches every view transition and the tile stagger off under reduced motion", () => {
    const reduced = section.slice(
      section.indexOf("@media (prefers-reduced-motion: reduce)"),
    );
    expect(reduced).toContain("::view-transition-old(*)");
    expect(reduced).toContain("::view-transition-new(*)");
    expect(reduced).toContain("::view-transition-group(*)");
    expect(reduced).toMatch(/animation:\s*none\s*!important/);
    expect(reduced).toContain(".enter-up.tile-enter");
  });
});
