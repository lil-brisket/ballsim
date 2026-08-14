/**
 * Shared test helpers for deterministic simulation tests.
 */

import { createSeededRng, type Rng } from "@/domain/rng";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";

/** Fixed ISO timestamp used by factories unless overridden. */
export const TEST_NOW_ISO = "2026-08-13T12:00:00.000Z";

/** Default RNG seed for reproducible tests. */
export const TEST_RNG_SEED = 42;

/**
 * Creates a seeded RNG for tests. Prefer this over Math.random().
 */
export function createTestRng(seed: number = TEST_RNG_SEED): Rng {
  return createSeededRng(seed);
}

/**
 * Resets module-level domain event sequence counters between tests
 * when event IDs must be deterministic.
 */
export function resetTestEventSequence(): void {
  resetDomainEventSequenceForTests();
}
