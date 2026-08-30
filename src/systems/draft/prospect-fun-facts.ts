/**
 * Gameplay-derived prospect fun facts — no invented real-world bios.
 */

import type { DraftProspect } from "@/domain/entities/draft";
import { NATIONALITY_LABELS } from "@/domain/entities/player-nationality";
import type { LeagueArea } from "@/domain/game-settings";
import { resolveScoutingRegion } from "@/domain/entities/scouting-regions";
import { LEAGUE_AREA_LABELS } from "@/domain/game-settings";

export function prospectFunFact(
  prospect: DraftProspect,
  leagueArea: LeagueArea,
): string {
  const player = prospect.player;
  const region = resolveScoutingRegion(leagueArea, player.nationality);
  const nationalityLabel =
    NATIONALITY_LABELS[player.nationality] ?? player.nationality;
  const areaLabel = LEAGUE_AREA_LABELS[leagueArea];

  const facts: string[] = [];

  if (region === "international") {
    facts.push(
      `International prospect from ${nationalityLabel}, scouting outside the core ${areaLabel} footprint.`,
    );
  } else {
    facts.push(`Domestic prospect representing ${nationalityLabel}.`);
  }

  facts.push(
    `Projects as a ${player.archetype.replace(/_/g, " ")} at ${player.position}.`,
  );

  if (player.heightInches >= 82) {
    facts.push(
      `Stands ${Math.floor(player.heightInches / 12)}'${player.heightInches % 12}" — among the taller prospects in this class.`,
    );
  } else if (player.heightInches <= 74) {
    facts.push(
      `Compact frame at ${Math.floor(player.heightInches / 12)}'${player.heightInches % 12}" for a ${player.position}.`,
    );
  }

  if (player.age <= 20) {
    facts.push("One of the younger players in the draft age band.");
  } else if (player.age >= 22) {
    facts.push("Older for this draft class — closer to pro readiness.");
  }

  if (prospect.ranking <= 5) {
    facts.push("Sitting near the top of consensus pre-draft rankings.");
  } else if (prospect.ranking >= 40) {
    facts.push("A deeper-board name with developmental intrigue.");
  }

  // Deterministic pick from player id hash
  let hash = 0;
  for (let i = 0; i < player.id.length; i += 1) {
    hash = (hash + player.id.charCodeAt(i) * (i + 1)) % facts.length;
  }
  return facts[hash] ?? facts[0]!;
}
