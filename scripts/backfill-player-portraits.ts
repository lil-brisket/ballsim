/**
 * Backfill / repair persisted player portraits in every local save.
 * Re-runnable and idempotent: assigns missing or invalid entries, links each
 * face to a shared-library image, and re-resolves images that left the manifest.
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
    const usage = entry.usage
      ? ` images=${entry.usage.imagesInUse}/${entry.usage.libraryEntries} shared=${entry.usage.sharedImages} maxUses=${entry.usage.maxUses} unlinked=${entry.usage.unlinked} sameTeamConflicts=${entry.usage.sameTeamConflicts.length}`
      : "";
    const error = entry.error ? ` error=${entry.error}` : "";
    process.stdout.write(
      `${dryRun ? "[dry-run] " : ""}${entry.saveId} ${entry.status} assigned=${entry.assigned} resolved=${entry.resolved}${capacity}${usage}${error}\n`,
    );
  }
  if (results.some((entry) => entry.status === "failed")) {
    process.exitCode = 1;
  }
}

void main();
