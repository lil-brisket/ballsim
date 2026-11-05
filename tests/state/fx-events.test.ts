import { describe, expect, it } from "vitest";
import { COURT_FIXTURE_VIEW } from "@/app/dev/broadcast-ui/court-fixture";
import {
  animationProgress,
  ballSampler,
  rimTime,
} from "@/components/game/watch/court/court-motion";
import {
  ballHolderAt,
  buildCourtFxCelebration,
  buildCourtFxCues,
  cueProgress,
  fxUnit,
  isGameWinner,
  runLevel,
  type CourtFxCue,
} from "@/components/game/watch/court/fx/fx-events";
import {
  FX_TIERS,
  madeShotTier,
} from "@/components/game/watch/court/fx/fx-intensity";
import { teamLightColor } from "@/components/game/watch/court/team-token-colors";
import { buildPlayChoreography } from "@/state/watch-court-choreo";
import { COURT_RIM } from "@/state/watch-court-frame";
import { buildFullCourtFrame, toFullCourt } from "@/state/watch-full-court";
import type {
  WatchGameView,
  WatchHighlight,
  WatchTeam,
} from "@/state/watch-game-view";

const VIEW = COURT_FIXTURE_VIEW;
const MOTION_MS = 1500;

const THREE = 0;
const BLOCK = 1;
const REBOUND = 2;
const STEAL = 3;
const TWO = 4;
const PERSONAL_FOUL = 5;
const MISSED_THREE = 6;
const LOOSE_TURNOVER = 9;
const FT_MADE = 11;
const FT_MISSED = 12;
const SUBSTITUTION = 15;

function withHighlights(index: number, highlights: WatchHighlight[]) {
  return {
    ...VIEW,
    plays: VIEW.plays.map((play, i) =>
      i === index ? { ...play, highlights } : play,
    ),
  } satisfies WatchGameView;
}

function cuesFor(index: number, view: WatchGameView = VIEW): CourtFxCue[] {
  return buildCourtFxCues(
    view,
    buildPlayChoreography(view, index),
    buildFullCourtFrame(view, index + 1),
    MOTION_MS,
  );
}

const kinds = (cues: CourtFxCue[]) => cues.map((cue) => cue.kind);

describe("buildCourtFxCues", () => {
  it("is deterministic, with stable ids and seeds", () => {
    expect(cuesFor(THREE)).toEqual(cuesFor(THREE));
    const ids = cuesFor(THREE).map((cue) => cue.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe("dev_court_game:0:arena_pulse:0");
    const seeds = cuesFor(THREE).map((cue) => cue.seed);
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it("gives different games different seeds", () => {
    const other = { ...VIEW, gameId: "other_game" } as unknown as WatchGameView;
    expect(cuesFor(THREE, other)[0]!.seed).not.toBe(cuesFor(THREE)[0]!.seed);
  });

  it("starts a make's effects when the ball reaches the attacked rim", () => {
    const choreo = buildPlayChoreography(VIEW, THREE)!;
    const frame = buildFullCourtFrame(VIEW, THREE + 1);
    const rim = toFullCourt(COURT_RIM, frame.attackingEnd);
    for (const cue of cuesFor(THREE)) {
      expect(cue.at).toBe(rimTime(choreo));
      expect(cue.point).toEqual(rim);
      expect(cue.side).toBe(0);
    }
  });

  it("converts durations to play time using the play's length", () => {
    const pulse = cuesFor(THREE).find((cue) => cue.kind === "arena_pulse")!;
    expect(pulse.span).toBeCloseTo(1100 / MOTION_MS);
  });

  it("keeps an ordinary two quiet and lifts a three", () => {
    const two = cuesFor(TWO);
    expect(kinds(two)).toEqual(["arena_pulse", "rim_flash", "net_ripple"]);
    expect(two.every((cue) => cue.tier === "subtle")).toBe(true);

    const three = cuesFor(THREE);
    expect(kinds(three)).toContain("light_burst");
    expect(kinds(three)).not.toContain("accent_ring");
    expect(three.every((cue) => cue.tier === "moderate")).toBe(true);
  });

  it.each(["and_one", "clutch", "lead_change"] as const)(
    "adds an accent for %s",
    (highlight) => {
      const cues = cuesFor(TWO, withHighlights(TWO, [highlight]));
      expect(kinds(cues)).toContain("accent_ring");
      expect(kinds(cues)).toContain("floor_wash");
      expect(cues.every((cue) => cue.tier === "strong")).toBe(true);
    },
  );

  it("marks a late go-ahead shot that held up as the signature moment", () => {
    const last = VIEW.plays.length - 1;
    const view = withHighlights(last, ["clutch", "lead_change"]);
    expect(isGameWinner(view, last)).toBe(true);
    expect(cuesFor(last, view).every((cue) => cue.tier === "signature")).toBe(
      true,
    );
  });

  it("does not call a lead that was later lost a game winner", () => {
    const view = {
      ...VIEW,
      plays: VIEW.plays.map((play, i) =>
        i === TWO
          ? {
              ...play,
              highlights: ["clutch", "lead_change"] as WatchHighlight[],
            }
          : i === VIEW.plays.length - 1
            ? { ...play, highlights: ["lead_change"] as WatchHighlight[] }
            : play,
      ),
    };
    expect(isGameWinner(view, TWO)).toBe(false);
  });

  it("sparks the rim on a miss", () => {
    expect(kinds(cuesFor(MISSED_THREE))).toEqual(["rim_spark"]);
    expect(kinds(cuesFor(FT_MISSED))).toEqual(["rim_spark"]);
  });

  it("rings a block where the ball is met, not at the rim", () => {
    const [cue, ...rest] = cuesFor(BLOCK);
    expect(rest).toEqual([]);
    expect(cue!.kind).toBe("impact_ring");
    const frame = buildFullCourtFrame(VIEW, BLOCK + 1);
    expect(cue!.point).not.toEqual(toFullCourt(COURT_RIM, frame.attackingEnd));
  });

  it("flicks at the event of a turnover, harder for a steal", () => {
    const choreo = buildPlayChoreography(VIEW, STEAL)!;
    const [steal] = cuesFor(STEAL);
    expect(steal!.kind).toBe("steal_flick");
    expect(steal!.at).toBe(choreo.eventAt);
    expect(steal!.tier).toBe("moderate");
    expect(cuesFor(LOOSE_TURNOVER)[0]!.tier).toBe("subtle");
  });

  it("gives a made free throw only the small rim effects", () => {
    const cues = cuesFor(FT_MADE);
    expect(kinds(cues)).toEqual(["rim_flash", "net_ripple"]);
    expect(cues.every((cue) => cue.tier === "subtle")).toBe(true);
  });

  it("draws nothing for rebounds, fouls and substitutions", () => {
    expect(cuesFor(REBOUND)).toEqual([]);
    expect(cuesFor(PERSONAL_FOUL)).toEqual([]);
    expect(cuesFor(SUBSTITUTION)).toEqual([]);
  });

  it("draws nothing without a choreography or a play length", () => {
    const frame = buildFullCourtFrame(VIEW, 1);
    expect(buildCourtFxCues(VIEW, null, frame, MOTION_MS)).toEqual([]);
    const choreo = buildPlayChoreography(VIEW, THREE);
    expect(buildCourtFxCues(VIEW, choreo, frame, 0)).toEqual([]);
  });

  it("draws nothing when the frame belongs to another play", () => {
    const choreo = buildPlayChoreography(VIEW, THREE);
    const frame = buildFullCourtFrame(VIEW, 5);
    expect(buildCourtFxCues(VIEW, choreo, frame, MOTION_MS)).toEqual([]);
  });
});

describe("cueProgress", () => {
  const cue = { at: 0.5, span: 0.2 } as CourtFxCue;

  it("is null before and after the cue, and 0..1 during it", () => {
    expect(cueProgress(cue, 0.49)).toBeNull();
    expect(cueProgress(cue, 0.5)).toBe(0);
    expect(cueProgress(cue, 0.6)).toBeCloseTo(0.5);
    expect(cueProgress(cue, 0.7)).toBeNull();
  });

  it("can run past the end of the play", () => {
    expect(cueProgress({ at: 0.9, span: 0.3 } as CourtFxCue, 1.1)).toBeCloseTo(
      2 / 3,
    );
  });

  it("never shows a cue with no duration", () => {
    expect(cueProgress({ at: 0.5, span: 0 } as CourtFxCue, 0.5)).toBeNull();
  });

  it("holds a cue on screen when speed would make it a blink", () => {
    const short = { at: 0.5, span: 0.1 } as CourtFxCue;
    expect(cueProgress(short, 0.65)).toBeNull();
    expect(cueProgress(short, 0.65, 0.3)).toBeCloseTo(0.5);
    expect(cueProgress(short, 0.55, 0.01)).toBeCloseTo(0.5);
  });
});

describe("buildCourtFxCelebration", () => {
  it("celebrates the winner, and the game winner hardest", () => {
    const plain = buildCourtFxCelebration(VIEW)!;
    expect(plain.side).toBe(0);
    expect(plain.tier).toBe("strong");
    const last = VIEW.plays.length - 1;
    expect(
      buildCourtFxCelebration(withHighlights(last, ["clutch", "lead_change"]))!
        .tier,
    ).toBe("signature");
  });

  it("is null with no plays or no winner", () => {
    expect(buildCourtFxCelebration({ ...VIEW, plays: [] })).toBeNull();
    expect(
      buildCourtFxCelebration({
        ...VIEW,
        plays: [{ ...VIEW.plays[0]!, homeScore: 5, awayScore: 5 }],
      }),
    ).toBeNull();
  });
});

describe("ballSampler", () => {
  it("passes through the choreography's ball at every beat", () => {
    const choreo = buildPlayChoreography(VIEW, THREE)!;
    const at = ballSampler(choreo);
    choreo.beats.forEach((beat, k) => {
      const sample = at(beat);
      expect(sample.x).toBeCloseTo(choreo.ball[k]!.at.x, 3);
      expect(sample.y).toBeCloseTo(choreo.ball[k]!.at.y, 3);
    });
  });

  it("lifts the ball through the shot leg and rests it at the ends", () => {
    const choreo = buildPlayChoreography(VIEW, THREE)!;
    const at = ballSampler(choreo);
    const shot = choreo.legs.indexOf("shot");
    const from = choreo.beats[shot]!;
    const to = choreo.beats[shot + 1]!;
    expect(at((from + to) / 2).liftPx).toBeGreaterThan(10);
    expect(at(from).liftPx).toBeCloseTo(0);
    expect(at(to).liftPx).toBeCloseTo(0);
  });

  it("clamps outside the play", () => {
    const choreo = buildPlayChoreography(VIEW, THREE)!;
    const at = ballSampler(choreo);
    expect(at(-1).x).toBeCloseTo(at(0).x);
    expect(at(2).x).toBeCloseTo(at(1).x);
  });
});

describe("ballHolderAt", () => {
  it("follows the ball and flags the shot", () => {
    const choreo = buildPlayChoreography(VIEW, THREE)!;
    const shot = choreo.legs.indexOf("shot");
    const during = (choreo.beats[shot]! + choreo.beats[shot + 1]!) / 2;
    expect(ballHolderAt(choreo, during).shooting).toBe(true);
    expect(ballHolderAt(choreo, 0).holderId).toBe(choreo.ball[0]!.holderId);
  });
});

describe("animationProgress", () => {
  const animation = (currentTime: number | null, endTime = 1000) =>
    ({
      currentTime,
      effect: { getComputedTiming: () => ({ endTime }) },
    }) as unknown as Animation;

  it("reads the animation's own time as a fraction of its length", () => {
    expect(animationProgress(animation(250))).toBe(0.25);
  });

  it("holds at 1 once finished, and is null when cancelled", () => {
    expect(animationProgress(animation(1000))).toBe(1);
    expect(animationProgress(animation(5000))).toBe(1);
    expect(animationProgress(animation(null))).toBeNull();
  });
});

describe("fx-intensity", () => {
  it("ranks a game winner over a highlight over a three over a two", () => {
    expect(madeShotTier("two_made", [], false)).toBe("subtle");
    expect(madeShotTier("three_made", [], false)).toBe("moderate");
    expect(madeShotTier("two_made", ["clutch"], false)).toBe("strong");
    expect(madeShotTier("two_made", [], true)).toBe("signature");
  });

  it("grows with every tier", () => {
    const order = ["subtle", "moderate", "strong", "signature"] as const;
    for (let i = 1; i < order.length; i += 1) {
      expect(FX_TIERS[order[i]!].burstRadius).toBeGreaterThan(
        FX_TIERS[order[i - 1]!].burstRadius,
      );
      expect(FX_TIERS[order[i]!].pulseAlpha).toBeGreaterThan(
        FX_TIERS[order[i - 1]!].pulseAlpha,
      );
    }
  });
});

describe("teamLightColor", () => {
  const withColors = (
    primaryColor: string,
    accentColor: string,
    secondaryColor: string,
  ): WatchTeam => ({
    ...VIEW.home,
    branding: {
      ...VIEW.home.branding,
      primaryColor,
      accentColor,
      secondaryColor,
    },
  });

  it("uses a bright primary as it is", () => {
    expect(teamLightColor(withColors("#F2F0E6", "#000000", "#000000"))).toBe(
      "#F2F0E6",
    );
  });

  it("skips a primary that would read as shadow", () => {
    expect(teamLightColor(withColors("#0B1F3A", "#F5B800", "#C4CED4"))).toBe(
      "#F5B800",
    );
    expect(teamLightColor(withColors("#0B1F3A", "#111111", "#C4CED4"))).toBe(
      "#C4CED4",
    );
  });

  it("falls back to white when every brand colour is dark", () => {
    expect(teamLightColor(withColors("#0B1F3A", "#111111", "#000000"))).toBe(
      "#FFFFFF",
    );
  });
});

describe("particles and runs", () => {
  it("gives stable values in [0, 1) that vary by index and seed", () => {
    expect(fxUnit(42, 3)).toBe(fxUnit(42, 3));
    expect(fxUnit(42, 3)).not.toBe(fxUnit(42, 4));
    expect(fxUnit(42, 3)).not.toBe(fxUnit(43, 3));
    for (let i = 0; i < 200; i += 1) {
      const value = fxUnit(7, i);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("burns hotter as a run grows, up to a cap", () => {
    expect(runLevel(0)).toBe(0);
    expect(runLevel(8)).toBeLessThan(runLevel(14));
    expect(runLevel(40)).toBe(1);
  });
});
