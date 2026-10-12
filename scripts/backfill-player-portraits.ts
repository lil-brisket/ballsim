/**
 * Backfill / repair persisted player portraits in every local save.
 * Re-runnable and idempotent: only missing or invalid entries are assigned.
 *
 * Usage:
 *   npx tsx --conditions=react-server scripts/backfill-player-portraits.ts [--dry-run]
 *
 * Requires DATABASE_URL (loaded from .env).
 */

import "dotenv/config";
import { repairPlayerPortraits } from "@/application/repair-player-portraits";
import { createPrismaSaveGameStore } from "@/persistence/save-game-repository";

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const results = await repairPlayerPortraits(createPrismaSaveGameStore(), {
    dryRun,
  });
  for (const entry of results) {
    const capacity = entry.capacity
      ? ` active=${entry.capacity.activeAssigned} missing=${entry.capacity.activeMissing} duplicates=${entry.capacity.duplicates} utilization=${entry.capacity.utilization.toExponential(2)}`
      : "";
    const error = entry.error ? ` error=${entry.error}` : "";
    process.stdout.write(
      `${dryRun ? "[dry-run] " : ""}${entry.saveId} ${entry.status} assigned=${entry.assigned}${capacity}${error}\n`,
    );
  }
  if (results.some((entry) => entry.status === "failed")) {
    process.exitCode = 1;
  }
}

void main();
