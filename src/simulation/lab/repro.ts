export type ReproCommandInput = {
  seed: number | string;
  scenarioId: string;
  games?: number;
  rotation?: "on" | "off";
  mode?: string;
  seasons?: number;
  channel?: "pr" | "nightly";
};

export function formatReproCommand(input: ReproCommandInput): string {
  const parts = [
    "npm run sim --",
    `--seed=${input.seed}`,
    `--scenario=${input.scenarioId}`,
  ];
  if (input.games != null) {
    parts.push(`--games=${input.games}`);
  }
  if (input.rotation === "off") {
    parts.push("--rotation=off");
  }
  if (input.mode != null && input.mode !== "game") {
    parts.push(`--mode=${input.mode}`);
  }
  if (input.seasons != null) {
    parts.push(`--seasons=${input.seasons}`);
  }
  if (input.channel === "nightly") {
    parts.push("--channel=nightly");
  }
  return parts.join(" ");
}
