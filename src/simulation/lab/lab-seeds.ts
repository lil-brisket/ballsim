import { deriveSeed, normalizeSeed } from "@/domain/rng";

export type LabSeedListEntry = {
  stream: string;
  seed: number;
};

export function labRosterStreamName(scenarioId: string): string {
  return `${scenarioId}:roster`;
}

export function labGameStreamName(
  scenarioId: string,
  gameIndex: number,
): string {
  if (!Number.isInteger(gameIndex) || gameIndex < 0) {
    throw new Error(
      "labGameStreamName: gameIndex must be a non-negative integer.",
    );
  }
  return `${scenarioId}:game:${gameIndex}`;
}

export function labRosterSeed(
  master: number | string,
  scenarioId: string,
): number {
  return deriveSeed(master, labRosterStreamName(scenarioId));
}

export function labGameSeed(
  master: number | string,
  scenarioId: string,
  gameIndex: number,
): number {
  return deriveSeed(master, labGameStreamName(scenarioId, gameIndex));
}

export function buildGameModeSeedList(
  master: number | string,
  scenarioId: string,
  games: number,
): LabSeedListEntry[] {
  if (!Number.isInteger(games) || games < 1) {
    throw new Error("buildGameModeSeedList: games must be a positive integer.");
  }
  const list: LabSeedListEntry[] = [
    {
      stream: labRosterStreamName(scenarioId),
      seed: labRosterSeed(master, scenarioId),
    },
  ];
  for (let gameIndex = 0; gameIndex < games; gameIndex += 1) {
    list.push({
      stream: labGameStreamName(scenarioId, gameIndex),
      seed: labGameSeed(master, scenarioId, gameIndex),
    });
  }
  return list;
}

export function buildMasterSeedList(
  master: number | string,
  stream: string,
): LabSeedListEntry[] {
  if (stream.length === 0) {
    throw new Error("buildMasterSeedList: stream must be non-empty.");
  }
  return [{ stream, seed: normalizeSeed(master) }];
}

export function seedForStream(
  seedList: readonly LabSeedListEntry[],
  stream: string,
): number {
  const entry = seedList.find((item) => item.stream === stream);
  if (entry == null) {
    throw new Error(`Lab seed list missing stream "${stream}".`);
  }
  return entry.seed;
}

export function assertGameModeSeedList(
  seedList: readonly LabSeedListEntry[],
  scenarioId: string,
  games: number,
): void {
  seedForStream(seedList, labRosterStreamName(scenarioId));
  for (let gameIndex = 0; gameIndex < games; gameIndex += 1) {
    seedForStream(seedList, labGameStreamName(scenarioId, gameIndex));
  }
}
