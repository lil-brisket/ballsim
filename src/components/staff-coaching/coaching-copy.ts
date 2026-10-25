import { COACHING_PHILOSOPHY_CONFIG as CONFIG } from "@/domain/coaching/coaching-philosophy-config";

export const PACE_LABELS: Record<string, string> = {
  fast: "Fast",
  balanced: "Balanced",
  halfCourt: "Half court",
};

export const EMPHASIS_LABELS: Record<string, string> = {
  threePointHeavy: "Three-point heavy",
  balanced: "Balanced",
  inside: "Inside",
};

export const DEFENSE_LABELS: Record<string, string> = {
  aggressive: "Aggressive",
  balanced: "Balanced",
  conservative: "Conservative",
};

const pct = (n: number) => `${Math.round(Math.abs(n) * 100)}%`;
const delta = (multiplier: number) => pct(multiplier - 1);

export function paceExplanation(pace: string): string {
  const seconds =
    CONFIG.possessionSecondsDelta[
      pace as keyof typeof CONFIG.possessionSecondsDelta
    ] ?? 0;
  if (seconds < 0) {
    return `Possessions run about ${Math.abs(seconds)}s quicker: more shots for both teams.`;
  }
  if (seconds > 0) {
    return `Possessions run about ${seconds}s longer: fewer, more deliberate shots.`;
  }
  return "Normal tempo.";
}

export function emphasisExplanation(emphasis: string): string {
  const shot =
    CONFIG.shotSelection[emphasis as keyof typeof CONFIG.shotSelection];
  if (shot && shot.threePoint > 1) {
    return `Players lean about ${delta(shot.threePoint)} more toward three-point attempts.`;
  }
  if (shot && shot.finishing > 1) {
    return `Players lean about ${delta(shot.finishing)} more toward shots at the rim.`;
  }
  return "Shot mix follows each player's strengths.";
}

export function defenseExplanation(approach: string): string {
  const key = approach as keyof typeof CONFIG.defensivePressureMultiplier;
  const pressure = CONFIG.defensivePressureMultiplier[key] ?? 1;
  const fouls = CONFIG.foulActionWeightMultiplier[key] ?? 1;
  if (pressure > 1) {
    return `About ${delta(pressure)} more pressure on shooters, but about ${delta(fouls)} more fouls.`;
  }
  if (pressure < 1) {
    return `About ${delta(pressure)} less pressure on shooters, with about ${delta(fouls)} fewer fouls.`;
  }
  return "Standard pressure and foul rate.";
}

export function focalExplanation(name: string | null): string {
  if (!name) return "Shots go to whoever the usage model favours.";
  const usage = CONFIG.focalPlayerUsageMultiplier;
  return `${name} gets about ${delta(usage.shot)} more shot chances and ${delta(usage.involvement)} more touches while on the court. Has no effect while they sit.`;
}

export function rotationExplanation(style: string): string {
  if (style === "tight") {
    return "10-man rotation; starters carry the most minutes.";
  }
  if (style === "deep") {
    return "12-man rotation with minutes spread to the bench.";
  }
  return "12-man rotation with standard minutes.";
}

export function presetSummary(preset: {
  pace: string;
  offensiveEmphasis: string;
  defensiveApproach: string;
  rotationStyle: string;
}): string {
  const pace =
    preset.pace === "halfCourt"
      ? "Half-court pace"
      : `${PACE_LABELS[preset.pace] ?? preset.pace} pace`;
  const offense = EMPHASIS_LABELS[preset.offensiveEmphasis] ?? "";
  const defense = DEFENSE_LABELS[preset.defensiveApproach] ?? "";
  const rotation =
    preset.rotationStyle.charAt(0).toUpperCase() +
    preset.rotationStyle.slice(1);
  return [
    pace,
    offense === "Balanced" ? "Balanced offense" : offense,
    `${defense} D`,
    `${rotation} rotation`,
  ].join(" · ");
}
