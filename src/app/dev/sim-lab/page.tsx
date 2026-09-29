import { SimLabWorkspace } from "@/components/dev/sim-lab/SimLabWorkspace";
import {
  LAB_MAX_GAMES,
  LAB_MAX_SEASONS_CBL,
  LAB_MAX_SEASONS_STANDARD,
} from "@/simulation/lab/lab-limits";
import {
  LAB_LEAGUE_PRESETS,
  labPresetScheduleLabel,
} from "@/simulation/lab/lab-league-preset";
import { LAB_SCENARIO_IDS } from "@/simulation/lab/scenarios";

export default function SimLabPage() {
  return (
    <SimLabWorkspace
      config={{
        scenarioIds: LAB_SCENARIO_IDS,
        presets: LAB_LEAGUE_PRESETS.map((id) => ({
          id,
          label: labPresetScheduleLabel(id),
        })),
        maxGames: LAB_MAX_GAMES,
        maxSeasonsCbl: LAB_MAX_SEASONS_CBL,
        maxSeasonsStandard: LAB_MAX_SEASONS_STANDARD,
      }}
    />
  );
}
