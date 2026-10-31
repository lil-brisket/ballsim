/**
 * Build the browser-test saves into a fresh prisma/e2e.db (`npm run e2e:seed`).
 *
 * Creates one CBL league from a fixed seed through the real Owner Mode
 * services, plays it unattended and snapshots it at four points (see
 * e2e/seed-saves.ts): regular season, playoffs, draft, free agency. Same seed, same
 * league: ratings, schedule, results and transactions match run to run.
 * Only wall-clock timestamps differ.
 *
 * Runs with `--conditions=react-server` because the services import
 * `server-only`. In GitHub Actions it also exports E2E_SAVE_ID for the
 * following steps.
 */

import { execSync } from "node:child_process";
import { appendFileSync, rmSync } from "node:fs";
import { E2E_DATABASE_URL, E2E_SAVES } from "../e2e/seed-saves";

const RNG_SEED = 42;

/**
 * League, conference and team ids (and event ids) come from
 * crypto.randomUUID; a counter makes them, and so the processing order of
 * everything sorted by id, the same on every run.
 */
let uuidCounter = 0;
crypto.randomUUID = (() =>
  `00000000-0000-4000-8000-${String(uuidCounter++).padStart(12, "0")}`) as typeof crypto.randomUUID;

function resetDatabase(): void {
  for (const suffix of ["", "-journal"]) {
    rmSync(`prisma/e2e.db${suffix}`, { force: true });
  }
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
    stdio: "inherit",
  });
}

async function main(): Promise<void> {
  const started = Date.now();
  resetDatabase();
  // Read lazily by the Prisma client on first use, after the imports below.
  process.env.DATABASE_URL = E2E_DATABASE_URL;

  const service = await import("@/application/game-service");
  const { createPrismaSaveGameStore } =
    await import("@/persistence/save-game-repository");
  const { asSaveId } = await import("@/domain/ids");
  const { applyPreset, CBL_GAME_SETTINGS, cloneGameSettings } =
    await import("@/domain/game-settings");
  const { calendarDaysBetween } = await import("@/domain/calendar-date");
  const { hasPendingBoardDirective } = await import("@/systems/board-pressure");
  const { isUserOnDraftClock } = await import("@/systems/draft");
  const { toDraftBoardView } = await import("@/state/selectors/market");
  const { canAdvancePhase, getActivePhaseId } =
    await import("@/systems/phase-engine");
  type GameState = import("@/state/game-state").GameState;
  type SaveGameStore = import("@/persistence/save-game-store").SaveGameStore;

  const withSaveId = (state: GameState, id: string): GameState => ({
    ...state,
    meta: { ...state.meta, saveId: asSaveId(id) },
  });

  const store = createPrismaSaveGameStore();
  // The played save is the free-agency one, so it keeps its archived
  // season history; the earlier points are copies taken in season one,
  // before anything is archived.
  const playedStore: SaveGameStore = {
    ...store,
    create: (input) =>
      store.create({
        ...input,
        id: E2E_SAVES.offseason,
        state: withSaveId(input.state, E2E_SAVES.offseason),
      }),
  };

  const settings = cloneGameSettings(CBL_GAME_SETTINGS);
  settings.ai.managementPreset = "continuity";
  settings.ai.assistance = applyPreset("continuity");

  const unwrap = <T extends { ok: boolean }>(result: T): T => {
    if (!result.ok) {
      throw new Error((result as { error?: string }).error ?? "failed");
    }
    return result;
  };

  unwrap(
    await service.createNewOwnerSave(
      { name: "E2E Free Agency", settings, rngSeed: RNG_SEED },
      playedStore,
    ),
  );
  const saveId = E2E_SAVES.offseason;
  const load = async (): Promise<GameState> => {
    const loaded = await store.load(saveId);
    if (!loaded) throw new Error("E2E save disappeared.");
    return loaded.state;
  };
  // Choosing the already-active default team leaves onboarding unconfirmed
  // (the dashboard then redirects to team selection), so take another one.
  const created = await load();
  const teamId = Object.keys(created.world.teams)
    .sort()
    .find((id) => id !== created.user.activeOwnerTeamId)!;
  unwrap(await service.selectOwnerTeam(saveId, teamId, store));
  const selected = (await load()).user;
  const franchise = selected.ownedFranchises[selected.activeOwnerTeamId];
  if (
    !franchise?.citySelectionConfirmed ||
    !franchise.franchiseIdentityConfirmed
  ) {
    throw new Error("Team selection did not finish onboarding.");
  }

  const copy = async (id: string, name: string, state: GameState) => {
    await store.create({ id, name, state: withSaveId(state, id) });
    console.log(`${id}: ${state.world.calendar.currentDate}`);
  };

  /** What an unattended owner does when the calendar cannot move. */
  const handleGates = async (state: GameState): Promise<boolean> => {
    const blocking = state.user.pendingOwnerDecisions.filter(
      (decision) => decision.blockingLevel === "blocking",
    );
    for (const decision of blocking) {
      unwrap(await service.declineOwnerDecision(saveId, decision.id, store));
    }
    if (blocking.length > 0) return true;
    if (hasPendingBoardDirective(state)) {
      unwrap(
        await service.resolveOwnerBoardDirective(saveId, "accept_plan", store),
      );
      return true;
    }
    if (state.competition.season.phase === "postseason") {
      unwrap(await service.beginOffseason(saveId, store));
      return true;
    }
    const phaseId = getActivePhaseId(state);
    if (phaseId === "offseason.draft_preparation") {
      unwrap(
        await service.resolveOwnerDraftClassDecision(
          saveId,
          { source: "generated" },
          store,
        ),
      );
    }
    if (isUserOnDraftClock(state)) {
      const view = await service.loadOwnerSaveView(saveId, store);
      const prospect = view?.draftBoard?.eligibleProspects[0];
      if (!prospect) throw new Error("On the draft clock with no prospect.");
      unwrap(
        await service.selectOwnerDraftProspect(
          saveId,
          prospect.playerId,
          store,
        ),
      );
      return true;
    }
    const current = await load();
    const userPaced =
      getActivePhaseId(current) === "offseason.roster_decisions" ||
      getActivePhaseId(current) === "offseason.draft_preparation" ||
      getActivePhaseId(current) === "offseason.draft" ||
      getActivePhaseId(current) === "preseason.preparation";
    if (userPaced && canAdvancePhase(current)) {
      return (await service.advanceLeaguePhaseCommand(saveId, store)).ok;
    }
    return false;
  };

  let copiedRegular = false;
  let copiedPlayoffs = false;
  let copiedDraft = false;
  for (let step = 0; step < 1_000; step += 1) {
    const state = await load();
    const phaseId = getActivePhaseId(state);
    const date = state.world.calendar.currentDate;
    const season = state.competition.season;

    if (
      !copiedRegular &&
      phaseId === "regular" &&
      season.regularSeasonStartDate !== null &&
      calendarDaysBetween(season.regularSeasonStartDate, date) >= 14
    ) {
      if (
        season.tradeDeadlineDate !== null &&
        date >= season.tradeDeadlineDate
      ) {
        throw new Error("Passed the trade deadline before the first snapshot.");
      }
      await copy(E2E_SAVES.regularSeason, "E2E Regular Season", state);
      copiedRegular = true;
    }
    if (
      !copiedPlayoffs &&
      phaseId === "playoffs" &&
      state.competition.playoffs.series.some((series) =>
        Object.values(series.wins).some((wins) => wins > 0),
      )
    ) {
      await copy(E2E_SAVES.playoffs, "E2E Playoffs", state);
      copiedPlayoffs = true;
    }
    if (
      !copiedDraft &&
      phaseId === "offseason.draft" &&
      (toDraftBoardView(state)?.eligibleProspects.length ?? 0) > 0
    ) {
      await copy(E2E_SAVES.draft, "E2E Draft", state);
      copiedDraft = true;
    }
    if (phaseId === "offseason.free_agency") {
      const entered = state.competition.phase?.enteredDate ?? date;
      if (calendarDaysBetween(entered, date) >= 1) {
        if (!copiedRegular || !copiedPlayoffs || !copiedDraft) {
          throw new Error("Reached free agency without all earlier snapshots.");
        }
        console.log(`${saveId}: ${date}`);
        console.log(
          `Seeded ${Object.values(E2E_SAVES).join(", ")} in ${Math.round((Date.now() - started) / 1000)}s`,
        );
        if (process.env.GITHUB_ENV) {
          appendFileSync(
            process.env.GITHUB_ENV,
            `E2E_SAVE_ID=${E2E_SAVES.regularSeason}\n`,
          );
        }
        return;
      }
    }

    if (await handleGates(state)) continue;

    // Single days near a snapshot point, otherwise a week at a time.
    const days =
      phaseId === "playoffs" || phaseId === "offseason.free_agency" ? 1 : 7;
    const advanced = await service.advanceOwnerTime(
      saveId,
      { days, stopOnPhaseChange: true },
      store,
    );
    if (!advanced.ok) {
      throw new Error(`${date} ${phaseId}: ${advanced.error}`);
    }
  }
  throw new Error("Did not reach free agency within 1,000 steps.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
