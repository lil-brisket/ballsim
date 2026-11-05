import { describe, expect, it } from "vitest";
import {
  PORTRAIT_HAIR,
  PORTRAIT_SKIN,
  PORTRAIT_SKIN_SHADOW,
} from "@/components/basketball/portrait-palette";
import {
  athleteAppearance,
  hairShape,
} from "@/components/game/watch/court/fx/athlete-look";
import { jumpTimeFor } from "@/components/game/watch/court/fx/fx-athlete";
import { COURT_FIXTURE_VIEW } from "@/app/dev/broadcast-ui/court-fixture";
import { asPlayerId, type PlayerId } from "@/domain/ids";
import { buildPlayChoreography } from "@/state/watch-court-choreo";

const ID = asPlayerId("p1");

describe("athleteAppearance", () => {
  it("uses the player's own portrait skin and hair, and their height", () => {
    const look = athleteAppearance(
      {
        playerId: ID,
        look: { skinTone: 7, hairColor: 4, hairStyle: 4, heightInches: 82 },
      },
      "p1",
    );
    expect(look.skin).toBe(PORTRAIT_SKIN[7]);
    expect(look.skinShadow).toBe(PORTRAIT_SKIN_SHADOW[7]);
    expect(look.hair).toBe(PORTRAIT_HAIR[4]);
    expect(look.hairStyle).toBe(4);
    expect(look.heightInches).toBe(82);
  });

  it("gives different players different looks from their traits", () => {
    const a = athleteAppearance(
      {
        playerId: ID,
        look: { skinTone: 0, hairColor: 0, hairStyle: 0, heightInches: 70 },
      },
      "p1",
    );
    const b = athleteAppearance(
      {
        playerId: asPlayerId("p2"),
        look: { skinTone: 9, hairColor: 6, hairStyle: 4, heightInches: 86 },
      },
      "p2",
    );
    expect(a.skin).not.toBe(b.skin);
    expect(a.heightInches).toBeLessThan(b.heightInches);
  });

  it("keeps a player with no portrait stable and in range", () => {
    const first = athleteAppearance({ playerId: ID }, "p1");
    expect(athleteAppearance({ playerId: ID }, "p1")).toEqual(first);
    expect(PORTRAIT_SKIN).toContain(first.skin);
    expect(first.heightInches).toBe(78);
  });

  it("copes with a player record that is gone", () => {
    expect(athleteAppearance(undefined, "gone").skin).toBeTruthy();
  });

  it("keeps extreme heights from breaking the proportions", () => {
    const tall = athleteAppearance(
      {
        playerId: ID,
        look: { skinTone: 0, hairColor: 0, hairStyle: 0, heightInches: 110 },
      },
      "p1",
    );
    expect(tall.heightInches).toBe(90);
  });
});

describe("hairShape", () => {
  it("covers every portrait hair style", () => {
    expect(hairShape(0)).toBe("none");
    expect(hairShape(4)).toBe("afro");
    expect(hairShape(13)).toBe("long");
    for (let style = 0; style < 14; style += 1) {
      expect(hairShape(style)).toBeTruthy();
    }
  });

  it("falls back for an unknown style", () => {
    expect(hairShape(99)).toBe("cap");
  });
});

describe("jumpTimeFor", () => {
  const view = COURT_FIXTURE_VIEW;
  const made = buildPlayChoreography(view, 0)!;
  const shot = made.legs.indexOf("shot");

  it("has the shooter go up at the release", () => {
    const shooter = made.ball[shot]!.holderId as PlayerId;
    expect(jumpTimeFor(made, shooter, null)).toBe(made.beats[shot]);
  });

  it("has a blocker go up when they meet the ball", () => {
    const block = buildPlayChoreography(view, 1)!;
    const blockShot = block.legs.indexOf("shot");
    expect(jumpTimeFor(block, asPlayerId("h3"), asPlayerId("h3"))).toBe(
      block.beats[blockShot + 1],
    );
  });

  it("leaves everyone else on the floor", () => {
    expect(jumpTimeFor(made, asPlayerId("a4"), null)).toBeNull();
  });
});
