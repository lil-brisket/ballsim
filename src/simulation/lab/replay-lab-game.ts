import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkInvariants,
  eventsFromResult,
} from "@/simulation/lab/check-invariants";
import { ENGINE_VERSION } from "@/simulation/lab/engine-version";
import {
  diffEventLogs,
  loadEventNdjson,
} from "@/simulation/lab/event-log-diff";
import type { LabEventLogDiff } from "@/simulation/lab/event-log-diff";
import { failureArtifactsDir } from "@/simulation/lab/failure-artifacts";
import type { LabGameFailureRecord } from "@/simulation/lab/failure-artifacts";
import {
  createLabGameSession,
  labGamePlayerIds,
  labGameRosters,
  playLabGame,
} from "@/simulation/lab/lab-game-session";
import {
  compareEngineVersions,
  DEFAULT_LAB_RESULTS_ROOT,
  loadLabManifest,
  type LabRunManifest,
} from "@/simulation/lab/manifest";
import type { RawInvariantFailure } from "@/simulation/lab/types";

export type ReplayLabGameOptions = {
  runId: string;
  gameIndex: number;
  resultsRoot?: string;
};

export type LabReplayResult = {
  runId: string;
  gameIndex: number;
  seed: number | string;
  storedEventCount: number;
  replayedEventCount: number;
  matches: boolean;
  diffs: LabEventLogDiff[];
  storedFailures: RawInvariantFailure[];
  replayFailures: RawInvariantFailure[];
};

export function replayLabGame(options: ReplayLabGameOptions): LabReplayResult {
  if (!Number.isInteger(options.gameIndex) || options.gameIndex < 0) {
    throw new Error("replayLabGame: gameIndex must be a non-negative integer.");
  }
  const resultsRoot = options.resultsRoot ?? DEFAULT_LAB_RESULTS_ROOT;
  const manifest = loadLabManifest(
    join(resultsRoot, options.runId, "manifest.json"),
  );
  compareEngineVersions(manifest.engineVersion, ENGINE_VERSION);
  if (manifest.config.mode !== "game") {
    throw new Error(
      `replayLabGame: run ${options.runId} is mode ${manifest.config.mode}, expected game.`,
    );
  }
  const record = loadFailureRecord(
    resultsRoot,
    options.runId,
    options.gameIndex,
  );
  const storedEvents = loadEventNdjson(
    join(
      failureArtifactsDir(resultsRoot, options.runId),
      `${options.gameIndex}.ndjson`,
    ),
  );
  const session = createLabGameSession({
    seed: manifest.config.seed,
    games: manifest.config.games ?? options.gameIndex + 1,
    scenarioId: manifest.config.scenarioId,
    rotation: manifest.config.rotation,
    rosterSize: manifest.config.rosterSize,
    seedList: manifest.seedList,
  });
  let played = playLabGame(session, 0);
  for (let index = 1; index <= options.gameIndex; index += 1) {
    played = playLabGame(session, index);
  }
  const ids = labGamePlayerIds(session, options.gameIndex);
  const rosters = labGameRosters(session, options.gameIndex);
  const replayFailures = checkInvariants(
    {
      result: played.result,
      homePlayers: rosters.homePlayers,
      awayPlayers: rosters.awayPlayers,
      homePlayerIds: ids.homePlayerIds,
      awayPlayerIds: ids.awayPlayerIds,
      rotation: session.rotation,
      thrown: played.thrown,
    },
    options.gameIndex,
    played.gameSeed,
  );
  const replayedEvents = eventsFromResult(played.result);
  const diffs = diffEventLogs(storedEvents, replayedEvents);
  return {
    runId: options.runId,
    gameIndex: options.gameIndex,
    seed: record.seed,
    storedEventCount: storedEvents.length,
    replayedEventCount: replayedEvents.length,
    matches: diffs.length === 0,
    diffs,
    storedFailures: record.failures,
    replayFailures,
  };
}

function loadFailureRecord(
  resultsRoot: string,
  runId: string,
  gameIndex: number,
): LabGameFailureRecord {
  const jsonPath = join(
    failureArtifactsDir(resultsRoot, runId),
    `${gameIndex}.json`,
  );
  if (!existsSync(jsonPath)) {
    throw new Error(
      `replayLabGame: no failure record at ${jsonPath}. Replay requires a stored failure artifact.`,
    );
  }
  const parsed: unknown = JSON.parse(readFileSync(jsonPath, "utf8"));
  if (parsed == null || typeof parsed !== "object") {
    throw new Error(`replayLabGame: invalid failure record ${jsonPath}`);
  }
  return parsed as LabGameFailureRecord;
}

export type { LabRunManifest };
