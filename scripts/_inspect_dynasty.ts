import { config } from "dotenv";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { deserializeGameState } from "@/persistence/mappers/game-state-mapper";
import { toLeagueHistoryView } from "@/state/league-history-selectors";
import { getActivePhaseId } from "@/systems/phase-engine";

async function main(): Promise<void> {
  config();
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const db = new PrismaClient({ adapter: new PrismaLibSql({ url }) });
  const row =
    (await db.saveGame.findFirst({ where: { name: "10-Year Dynasty" } })) ??
    (await db.saveGame.findFirst({ orderBy: { updatedAt: "desc" } }));
  if (!row) {
    console.log("NO SAVE");
    await db.$disconnect();
    return;
  }
  const state = deserializeGameState(row.stateJson);
  const teamId = state.user.activeOwnerTeamId;
  const team = state.world.teams[teamId];
  const history = state.business.franchiseHistory[teamId];
  console.log(
    JSON.stringify(
      {
        id: row.id,
        jsonBytes: row.stateJson.length,
        date: state.world.calendar.currentDate,
        year: state.competition.season.year,
        seasonPhase: state.competition.season.phase,
        phaseId: getActivePhaseId(state),
        team: team ? `${team.city} ${team.name}` : teamId,
        historyKeys: Object.keys(state.business.franchiseHistory ?? {}),
        historySeasonCounts: Object.fromEntries(
          Object.entries(state.business.franchiseHistory ?? {}).map(
            ([id, h]) => [id, h.seasons.length],
          ),
        ),
        seasons:
          history?.seasons.map((s) => ({
            y: s.seasonYear,
            w: s.wins,
            l: s.losses,
            po: s.playoffResult,
            ch: s.championship,
          })) ?? [],
        standings: state.competition.standings?.byTeamId?.[teamId] ?? null,
        playoffs: {
          status: state.competition.playoffs?.status ?? null,
          champion: state.competition.playoffs?.championTeamId ?? null,
        },
        gameCount: Object.keys(state.competition.games ?? {}).length,
        archiveKind: Array.isArray(state.business.gameArchive)
          ? "array"
          : typeof state.business.gameArchive,
        archiveCount: Array.isArray(state.business.gameArchive)
          ? state.business.gameArchive.length
          : Object.keys(state.business.gameArchive ?? {}).length,
        playerHistoryCount: Object.keys(state.business.playerHistory ?? {})
          .length,
        samplePlayerHistory: Object.values(state.business.playerHistory ?? {})
          .slice(0, 2)
          .map((h) => ({
            seasons: h.seasons?.length ?? 0,
            years: h.seasons?.map((s) => s.seasonYear) ?? [],
          })),
        league: toLeagueHistoryView(state).seasons,
        staff: (() => {
          const all = Object.values(state.world.staff);
          const employed = all.filter((s) => s.teamId != null);
          const teamsMissing = Object.values(state.world.teams).filter(
            (team) => !all.some((s) => s.teamId === team.id),
          );
          return {
            total: all.length,
            employed: employed.length,
            teams: Object.keys(state.world.teams).length,
            teamsWithoutStaff: teamsMissing.map((t) => `${t.city} ${t.name}`),
          };
        })(),
        players: (() => {
          const all = Object.values(state.world.players);
          const retired = all.filter((p) => p.retired).length;
          const rostered = all.filter((p) => p.teamId != null && !p.retired).length;
          const free = all.filter((p) => p.teamId == null && !p.retired).length;
          return { total: all.length, retired, rostered, free };
        })(),
        awards: Object.values(state.business.awards?.results ?? {}).reduce(
          (acc, award) => {
            acc[award.cadence] = (acc[award.cadence] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
        finances: Object.keys(state.business.finances ?? {}).length,
        userRoster: state.world.teams[teamId]?.roster.length ?? 0,
      },
      null,
      2,
    ),
  );
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
