"use server";

import {
  runGameLab,
  runScheduleLab,
  runSeasonLab,
  type GameLabInput,
  type GameLabSuccess,
  type ScheduleLabInput,
  type ScheduleLabSuccess,
  type SeasonLabInput,
  type SeasonLabSuccess,
  type SimLabFailure,
} from "@/application/sim-lab";

// Server actions stay callable by id even when the page 404s, so each one
// refuses on its own in production.
const DISABLED: SimLabFailure = {
  ok: false,
  error: "The simulation lab is not available in production.",
};

function simLabDisabled(): boolean {
  return process.env.NODE_ENV === "production";
}

export async function runGameLabAction(
  input: GameLabInput,
): Promise<GameLabSuccess | SimLabFailure> {
  if (simLabDisabled()) return DISABLED;
  return runGameLab(input);
}

export async function runSeasonLabAction(
  input: SeasonLabInput,
): Promise<SeasonLabSuccess | SimLabFailure> {
  if (simLabDisabled()) return DISABLED;
  return runSeasonLab(input);
}

export async function runScheduleLabAction(
  input: ScheduleLabInput,
): Promise<ScheduleLabSuccess | SimLabFailure> {
  if (simLabDisabled()) return DISABLED;
  return runScheduleLab(input);
}
