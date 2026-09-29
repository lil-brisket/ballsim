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

export async function runGameLabAction(
  input: GameLabInput,
): Promise<GameLabSuccess | SimLabFailure> {
  return runGameLab(input);
}

export async function runSeasonLabAction(
  input: SeasonLabInput,
): Promise<SeasonLabSuccess | SimLabFailure> {
  return runSeasonLab(input);
}

export async function runScheduleLabAction(
  input: ScheduleLabInput,
): Promise<ScheduleLabSuccess | SimLabFailure> {
  return runScheduleLab(input);
}
