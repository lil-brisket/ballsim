import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AccountAvatar } from "@/components/media-hub/timeline/AccountAvatar";
import {
  PostText,
  splitHashtags,
} from "@/components/media-hub/timeline/post-text";
import { StatLine } from "@/components/media-hub/timeline/StatLine";
import {
  TeamSurface,
  TeamSurfaceSlab,
} from "@/components/media-hub/timeline/TeamSurface";
import { TimelinePostShell } from "@/components/media-hub/timeline/TimelinePostShell";
import { UnreadDot } from "@/components/media-hub/timeline/UnreadDot";
import { VerifiedMark } from "@/components/media-hub/timeline/VerifiedMark";
import {
  resetStoriesSeenForTests,
  StoriesViewer,
} from "@/components/media-hub/stories/StoriesViewer";
import { resetDrawerScrollLockForTests } from "@/components/ui/drawer-scroll-lock";
import { contrastRatio } from "@/domain/color-contrast";
import { TEAM_INK_SURFACE, teamThemeVars } from "@/presentation/team-theme";
import type { TimelineAccount } from "@/state/media-timeline/accounts";
import type {
  TimelineDisplayContext,
  TimelinePostView,
} from "@/state/media-timeline/post-view";

afterEach(cleanup);

const branding = {
  primaryColor: "#1d4ed8",
  secondaryColor: "#facc15",
  accentColor: "#ffffff",
  logoId: "shield",
};

const context: TimelineDisplayContext = {
  saveId: "save-1",
  teams: { t1: { branding, href: "/dashboard/save-1/teams/t1" } },
  portraits: {},
};

function account(overrides: Partial<TimelineAccount> = {}): TimelineAccount {
  return {
    key: "fan:t1",
    kind: "fan",
    displayName: "Harbor Nest",
    handle: "@HarborNest",
    verified: false,
    teamId: "t1",
    playerId: null,
    beat: null,
    avatar: { type: "monogram", initials: "HN", teamId: "t1" },
    ...overrides,
  };
}

function post(overrides: Partial<TimelinePostView> = {}): TimelinePostView {
  return {
    id: "p1",
    kind: "league",
    occurredOn: "2026-10-08",
    dateLabel: "Oct 8",
    relativeLabel: "2d",
    unread: false,
    author: account(),
    text: "What a night.",
    tags: [],
    replies: [],
    engagement: { replies: 1, reposts: 2, likes: 3 },
    engagementDisplay: { replies: "1", reposts: "2", likes: "3" },
    engagementLabel: "1 reply, 2 reposts, 3 likes",
    attachment: { type: "league", headline: "h", summary: "s" },
    boxScoreHref: null,
    ...overrides,
  };
}

describe("TeamSurface", () => {
  it("renders an aria-hidden ink band and scopes team vars", () => {
    const { container } = render(
      <TeamSurface branding={branding} band="left">
        <p>body</p>
      </TeamSurface>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue("--team-primary")).toBe("#1D4ED8");
    const band = root.querySelector("[aria-hidden='true']")!;
    expect(band.className).toContain("bg-team-ink");
    expect(band.className).toContain("w-1.5");
    expect(screen.getByText("body")).toBeTruthy();
  });

  it("supports a top band and a solid slab", () => {
    const { container } = render(
      <TeamSurface branding={branding} band="top">
        <TeamSurfaceSlab>Title</TeamSurfaceSlab>
      </TeamSurface>,
    );
    expect(
      container.querySelector("[aria-hidden='true']")!.className,
    ).toContain("h-1.5");
    const slab = screen.getByText("Title");
    expect(slab.className).toContain("bg-team");
    expect(slab.className).toContain("text-on-team");
  });
});

describe("team theme contrast", () => {
  const cases = [
    ["very light", "#FFFFFF", "#F4F4F5"],
    ["very dark", "#0B1F3A", "#C4CED4"],
    ["neon", "#39FF14", "#0A0A0A"],
  ] as const;
  for (const [name, primaryColor, secondaryColor] of cases) {
    it(`keeps text and ink readable for a ${name} team`, () => {
      const vars = teamThemeVars({ primaryColor, secondaryColor });
      expect(
        contrastRatio(vars["--team-on-primary"], vars["--team-primary"]) ?? 0,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(vars["--team-ink"], TEAM_INK_SURFACE) ?? 0,
      ).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("AccountAvatar", () => {
  it("renders every type hidden from assistive tech", () => {
    const accounts = [
      account({ avatar: { type: "league", letters: "PHL" } }),
      account({ avatar: { type: "logo", teamId: "t1" } }),
      account({ avatar: { type: "logo", teamId: "missing" } }),
      account({
        playerId: "p1",
        avatar: { type: "portrait", playerId: "p1" },
      }),
      account(),
    ];
    for (const item of accounts) {
      const { container } = render(
        <AccountAvatar account={item} context={context} size="post" />,
      );
      const root = container.firstElementChild!;
      expect(root.getAttribute("aria-hidden")).toBe("true");
      expect(root.firstElementChild).not.toBeNull();
      cleanup();
    }
  });

  it("shows the league letters", () => {
    const { container } = render(
      <AccountAvatar
        account={account({ avatar: { type: "league", letters: "PHL" } })}
        context={context}
        size="reply"
      />,
    );
    expect(container.textContent).toContain("PHL");
  });

  it("sizes portraits and passes the team uniform", () => {
    const player = account({
      displayName: "Teo Valdane",
      playerId: "p1",
      avatar: { type: "portrait", playerId: "p1" },
    });
    const sizes = { reply: "sm", post: "ms", large: "md" } as const;
    for (const [size, portraitSize] of Object.entries(sizes)) {
      const { container } = render(
        <AccountAvatar
          account={player}
          context={context}
          size={size as keyof typeof sizes}
        />,
      );
      const portrait = container.querySelector("[data-portrait-size]")!;
      expect(portrait.getAttribute("data-portrait-size")).toBe(portraitSize);
      expect(portrait.getAttribute("data-portrait-uniform")).toBe("team");
      cleanup();
    }
  });

  it("omits the uniform for a player without a team", () => {
    const { container } = render(
      <AccountAvatar
        account={account({
          teamId: null,
          playerId: "p1",
          avatar: { type: "portrait", playerId: "p1" },
        })}
        context={context}
        size="post"
      />,
    );
    expect(
      container
        .querySelector("[data-portrait-size]")!
        .getAttribute("data-portrait-uniform"),
    ).toBeNull();
  });
});

describe("VerifiedMark", () => {
  it("is neutral and announces Verified", () => {
    const { container } = render(<VerifiedMark />);
    expect(container.innerHTML).not.toMatch(/amber|team/);
    expect(screen.getByText("Verified").className).toContain("sr-only");
  });
});

describe("UnreadDot", () => {
  it("renders once, after the time, for unread posts only", () => {
    const { container } = render(
      <TimelinePostShell post={post({ unread: true })} context={context} />,
    );
    const dots = container.querySelectorAll(".bg-team-ink");
    expect(dots).toHaveLength(1);
    const time = container.querySelector("time")!;
    expect(
      time.compareDocumentPosition(dots[0]!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("Unread")).toBeTruthy();
    cleanup();

    const read = render(
      <TimelinePostShell post={post({ unread: false })} context={context} />,
    );
    expect(read.container.querySelectorAll(".bg-team-ink")).toHaveLength(0);
  });

  it("uses one size and colour", () => {
    const { container } = render(<UnreadDot />);
    const dot = container.querySelector("[aria-hidden='true']")!;
    expect(dot.className).toBe("inline-block h-2 w-2 rounded-full bg-team-ink");
  });
});

describe("StatLine", () => {
  it("renders values, grouped left, without mono", () => {
    const { container } = render(
      <StatLine
        primary={[
          { label: "Points", value: "31" },
          { label: "Margin", value: "+11", tone: "win" },
          { label: "Turnovers", value: "-4", tone: "loss" },
        ]}
        secondary={[{ label: "FG", value: "12-21" }]}
      />,
    );
    for (const value of ["31", "+11", "-4", "12-21"]) {
      expect(screen.getByText(value)).toBeTruthy();
    }
    expect(container.innerHTML).not.toContain("justify-between");
    expect(container.innerHTML).not.toContain("font-mono");
    expect(screen.getByText("31").className).toContain("text-zinc-50");
    expect(screen.getByText("+11").className).toContain("text-win");
    expect(screen.getByText("-4").className).toContain("text-loss");
    expect(screen.getByText("31").className).toContain("text-3xl");
  });

  it("uses the large size", () => {
    render(<StatLine size="lg" primary={[{ label: "Points", value: "31" }]} />);
    expect(screen.getByText("31").className).toContain("text-5xl");
  });
});

describe("hashtags", () => {
  it("links tags and leaves other hashtags as plain text", () => {
    render(
      <p>
        <PostText
          text="Big win #Lights #HARvsSUM"
          tags={["Lights"]}
          saveId="save-1"
        />
      </p>,
    );
    const link = screen.getByRole("link", { name: "#Lights" });
    expect(link.getAttribute("href")).toBe(
      "/dashboard/save-1/media?tag=Lights",
    );
    expect(screen.queryByRole("link", { name: "#HARvsSUM" })).toBeNull();
    expect(screen.getByText("#HARvsSUM").className).toContain("text-team-ink");
  });

  it("splitHashtags is pure and keeps all text", () => {
    const text = "a #One b #Two";
    const first = splitHashtags(text);
    expect(splitHashtags(text)).toEqual(first);
    expect(first.map((part) => part.text).join("")).toBe(text);
    expect(first.filter((part) => part.type === "hashtag")).toHaveLength(2);
    expect(splitHashtags("no tags")).toEqual([
      { type: "text", text: "no tags" },
    ]);
  });
});

describe("StoriesViewer theme", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetStoriesSeenForTests();
    resetDrawerScrollLockForTests();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    resetDrawerScrollLockForTests();
  });

  it("copies the opener's team vars onto the portalled dialog", () => {
    render(
      <div
        style={
          {
            "--team-primary": "#123456",
            "--team-ink": "#ABCDEF",
          } as React.CSSProperties
        }
      >
        <StoriesViewer
          saveId="save-1"
          rings={[
            {
              key: "k",
              label: "Last night",
              latestOn: "2026-10-20",
              slideCount: 1,
              slides: ["slide"],
              media: null,
              mediaKind: "logo",
            },
          ]}
        />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Last night/ }));
    const root = screen.getByRole("dialog").parentElement!;
    expect(root.style.getPropertyValue("--team-ink")).toBe("#ABCDEF");
    expect(root.style.getPropertyValue("--team-primary")).toBe("#123456");
  });
});
