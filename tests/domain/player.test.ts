import { describe, expect, it } from "vitest";
import {
  createPlayer,
  PLAYER_POSITIONS,
  type PlayerAttributes,
  type PlayerInput,
} from "@/domain/entities/player";
import { PLAYER_ARCHETYPES } from "@/domain/entities/player-archetype";
import {
  asContractId,
  asPlayerId,
  asTeamId,
} from "@/domain/ids";

const VALID_ATTRIBUTES: PlayerAttributes = {
  speed: 74,
  strength: 66,
  athleticism: 74,
  stamina: 71,
  finishing: 68,
  midRange: 70,
  threePoint: 67,
  freeThrow: 73,
  ballHandling: 71,
  passing: 72,
  perimeterDefense: 65,
  interiorDefense: 60,
  steal: 63,
  block: 58,
  rebounding: 58,
  basketballIq: 69,
  offensiveIq: 70,
  defensiveIq: 64,
  consistency: 68,
};

function validInput(overrides: Partial<PlayerInput> = {}): PlayerInput {
  return {
    id: asPlayerId("player_1"),
    teamId: asTeamId("team_1"),
    firstName: "Alex",
    lastName: "Rivera",
    nationality: "USA",
    age: 24,
    heightInches: 75,
    weightPounds: 195,
    position: "PG",
    archetype: "floor_general",
    attributes: { ...VALID_ATTRIBUTES },
    potential: { overall: 82 },
    personality: {
      workEthic: 60,
      loyalty: 55,
      competitiveness: 65,
      leadership: 50,
      composure: 58,
    },
    contractId: asContractId("contract_1"),
    availability: "available",
    injury: null,
    suspension: null,
    development: { stage: "developing" },
    ...overrides,
  };
}

describe("createPlayer", () => {
  it("creates a valid player from PlayerInput", () => {
    const player = createPlayer(validInput());
    expect(player.id).toBe("player_1");
    expect(player.firstName).toBe("Alex");
    expect(player.lastName).toBe("Rivera");
    expect(player.nationality).toBe("USA");
    expect(player.age).toBe(24);
    expect(player.heightInches).toBe(75);
    expect(player.weightPounds).toBe(195);
    expect(player.position).toBe("PG");
    expect(player.archetype).toBe("floor_general");
    expect(player.teamId).toBe("team_1");
  });

  it("accepts all five positions", () => {
    for (const position of PLAYER_POSITIONS) {
      expect(createPlayer(validInput({ position })).position).toBe(position);
    }
  });

  it("rejects invalid positions", () => {
    expect(() =>
      createPlayer(validInput({ position: "XX" as PlayerInput["position"] })),
    ).toThrow(/position/);
  });

  it("accepts all nine archetypes", () => {
    for (const archetype of PLAYER_ARCHETYPES) {
      expect(createPlayer(validInput({ archetype })).archetype).toBe(archetype);
    }
  });

  it("rejects invalid archetypes", () => {
    expect(() =>
      createPlayer(
        validInput({ archetype: "point_god" as PlayerInput["archetype"] }),
      ),
    ).toThrow(/archetype/);
  });

  it("accepts valid nationalities", () => {
    expect(createPlayer(validInput({ nationality: "Canada" })).nationality).toBe(
      "Canada",
    );
    expect(createPlayer(validInput({ nationality: "Spain" })).nationality).toBe(
      "Spain",
    );
  });

  it("rejects invalid nationalities", () => {
    expect(() =>
      createPlayer(
        validInput({
          nationality: "Atlantis" as PlayerInput["nationality"],
        }),
      ),
    ).toThrow(/nationality/);
  });

  it("accepts compatible and uncommon position/archetype pairs", () => {
    expect(
      createPlayer(validInput({ position: "PG", archetype: "floor_general" }))
        .archetype,
    ).toBe("floor_general");
    expect(
      createPlayer(validInput({ position: "PG", archetype: "rim_protector" }))
        .archetype,
    ).toBe("rim_protector");
  });

  it("does not mutate the input object", () => {
    const input = validInput();
    const snapshot = structuredClone(input);
    createPlayer(input);
    expect(input).toEqual(snapshot);
  });

  it("rejects empty identity fields", () => {
    expect(() => createPlayer(validInput({ id: asPlayerId("") }))).toThrow(
      /id/,
    );
    expect(() => createPlayer(validInput({ firstName: "" }))).toThrow(
      /firstName/,
    );
    expect(() => createPlayer(validInput({ lastName: "   " }))).toThrow(
      /lastName/,
    );
  });

  it("requires the full attribute structure with 1–99 ratings", () => {
    const player = createPlayer(validInput());
    expect(player.attributes).toEqual(VALID_ATTRIBUTES);
    expect(Object.keys(player.attributes).sort()).toEqual(
      Object.keys(VALID_ATTRIBUTES).sort(),
    );
    expect("shooting" in player.attributes).toBe(false);
    expect("workEthic" in player.attributes).toBe(false);
    expect(player.personality.workEthic).toBe(60);

    expect(() =>
      createPlayer(
        validInput({
          attributes: {
            ...VALID_ATTRIBUTES,
            finishing: 0,
          },
        }),
      ),
    ).toThrow(/attributes\.finishing/);

    expect(() =>
      createPlayer(
        validInput({
          attributes: {
            ...VALID_ATTRIBUTES,
            finishing: 100,
          },
        }),
      ),
    ).toThrow(/attributes\.finishing/);

    expect(() =>
      createPlayer(
        validInput({
          attributes: {
            ...VALID_ATTRIBUTES,
            speed: -1,
          },
        }),
      ),
    ).toThrow(/attributes\.speed/);

    expect(() =>
      createPlayer(
        validInput({
          attributes: {
            ...VALID_ATTRIBUTES,
            midRange: 70.5,
          },
        }),
      ),
    ).toThrow(/attributes\.midRange/);

    const { finishing: _removed, ...missingFinishing } = VALID_ATTRIBUTES;
    expect(() =>
      createPlayer(
        validInput({
          attributes: missingFinishing as PlayerAttributes,
        }),
      ),
    ).toThrow(/attributes\.finishing/);

    expect(() =>
      createPlayer(
        validInput({
          attributes: {
            ...VALID_ATTRIBUTES,
            shooting: 70,
          } as PlayerAttributes,
        }),
      ),
    ).toThrow(/unknown key "shooting"/);
  });

  it("accepts boundary ratings 1 and 99", () => {
    const atMin = createPlayer(
      validInput({
        attributes: Object.fromEntries(
          Object.keys(VALID_ATTRIBUTES).map((key) => [key, 1]),
        ) as PlayerAttributes,
      }),
    );
    expect(atMin.attributes.speed).toBe(1);
    expect(atMin.attributes.consistency).toBe(1);

    const atMax = createPlayer(
      validInput({
        attributes: Object.fromEntries(
          Object.keys(VALID_ATTRIBUTES).map((key) => [key, 99]),
        ) as PlayerAttributes,
      }),
    );
    expect(atMax.attributes.speed).toBe(99);
    expect(atMax.attributes.consistency).toBe(99);
  });

  it("represents potential separately from attributes on the same rating scale", () => {
    const player = createPlayer(
      validInput({
        attributes: {
          ...VALID_ATTRIBUTES,
          finishing: 60,
        },
        potential: { overall: 90 },
      }),
    );
    expect(player.potential.overall).toBe(90);
    expect(player.attributes.finishing).toBe(60);

    expect(() =>
      createPlayer(validInput({ potential: { overall: 0 } })),
    ).toThrow(/potential\.overall/);
  });

  it("includes personality traits", () => {
    const player = createPlayer(validInput());
    expect(player.personality).toEqual({
      workEthic: 60,
      loyalty: 55,
      competitiveness: 65,
      leadership: 50,
      composure: 58,
    });
  });

  it("supports null or set contract references", () => {
    expect(createPlayer(validInput({ contractId: null })).contractId).toBeNull();
    expect(
      createPlayer(validInput({ contractId: asContractId("c_99") })).contractId,
    ).toBe("c_99");
  });

  it("represents availability and injury state", () => {
    const healthy = createPlayer(validInput());
    expect(healthy.availability).toBe("available");
    expect(healthy.injury).toBeNull();
    expect(healthy.suspension).toBeNull();

    const injured = createPlayer(
      validInput({
        availability: "out",
        injury: {
          injuryId: "inj_ankle_1",
          catalogKey: "ankle_sprain",
          type: "Ankle Sprain",
          bodyPart: "ankle",
          severity: "moderate",
          injuredOn: "2026-01-01",
          expectedReturnWindow: {
            earliest: "2026-01-08",
            latest: "2026-01-14",
          },
          recoveryProgress: 0,
          practiceRestriction: "rehab",
          gameRestriction: "out",
          minutesRestriction: 0,
          recommendedWorkloadMpg: null,
          maximumWorkloadMpg: 0,
          reinjuryRisk: 0.1,
          temporaryEffects: [],
          temporaryFrustration: 10,
          isReinjury: false,
          isAggravation: false,
          priorInjuryId: null,
          chronic: false,
          exposureSource: "game_acute",
        },
      }),
    );
    expect(injured.availability).toBe("out");
    expect(injured.injury?.type).toBe("Ankle Sprain");
    expect(injured.activeInjuries).toHaveLength(1);
  });

  it("represents development stage", () => {
    expect(createPlayer(validInput()).development.stage).toBe("developing");
    expect(
      createPlayer(validInput({ development: { stage: "prime" } })).development
        .stage,
    ).toBe("prime");
    expect(
      createPlayer(
        validInput({ development: { stage: "declining" } }),
      ).development.stage,
    ).toBe("declining");
  });

  it("rejects invalid age, height, and weight without clamping", () => {
    expect(() => createPlayer(validInput({ age: -1 }))).toThrow(/age/);
    expect(() => createPlayer(validInput({ age: 24.5 }))).toThrow(/age/);
    expect(() => createPlayer(validInput({ heightInches: 0 }))).toThrow(
      /heightInches/,
    );
    expect(() => createPlayer(validInput({ weightPounds: -10 }))).toThrow(
      /weightPounds/,
    );
  });
});
