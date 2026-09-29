import { describe, expect, it } from "vitest";
import { ENGINE_VERSION } from "@/simulation/lab/engine-version";
import { readEngineIdentity } from "@/simulation/lab/engine-identity";

describe("ENGINE_VERSION", () => {
  it("is a positive integer on engine identity", () => {
    expect(Number.isInteger(ENGINE_VERSION)).toBe(true);
    expect(ENGINE_VERSION).toBeGreaterThan(0);
    const identity = readEngineIdentity();
    expect(identity.engineVersion).toBe(ENGINE_VERSION);
  });
});
