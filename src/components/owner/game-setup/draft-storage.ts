import type { GameSettings } from "@/domain/game-settings";
import {
  LEAGUE_SETUP_PRESET_IDS,
  type LeagueSetupPresetId,
} from "@/domain/game-settings-presets";
import { validateGameSettings } from "@/domain/game-settings-validation";

export const NEW_GAME_DRAFT_KEY = "ballsim:new-game-draft";

export type NewGameDraft = {
  name: string;
  preset: LeagueSetupPresetId;
  settings: GameSettings;
  useCustomRoster: boolean;
  rosterPackageJson: string;
  rosterDropped: boolean;
};

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveNewGameDraft(
  draft: Omit<NewGameDraft, "rosterDropped">,
): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(
      NEW_GAME_DRAFT_KEY,
      JSON.stringify({ ...draft, rosterDropped: false }),
    );
    return;
  } catch {
    // Fall through and retry without the (possibly large) roster package.
  }
  try {
    store.setItem(
      NEW_GAME_DRAFT_KEY,
      JSON.stringify({
        ...draft,
        rosterPackageJson: "",
        rosterDropped: draft.rosterPackageJson.length > 0,
      }),
    );
  } catch {
    // Storage unavailable; nothing more to do.
  }
}

export function clearNewGameDraft(): void {
  try {
    storage()?.removeItem(NEW_GAME_DRAFT_KEY);
  } catch {
    // ignore
  }
}

export function loadNewGameDraft(): NewGameDraft | null {
  try {
    const raw = storage()?.getItem(NEW_GAME_DRAFT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<NewGameDraft> | null;
    if (data === null || typeof data !== "object") return null;
    if (!validateGameSettings(data.settings).ok) return null;
    const preset = LEAGUE_SETUP_PRESET_IDS.includes(
      data.preset as LeagueSetupPresetId,
    )
      ? (data.preset as LeagueSetupPresetId)
      : "custom";
    return {
      name: typeof data.name === "string" ? data.name : "",
      preset,
      settings: data.settings as GameSettings,
      useCustomRoster: data.useCustomRoster === true,
      rosterPackageJson:
        typeof data.rosterPackageJson === "string"
          ? data.rosterPackageJson
          : "",
      rosterDropped: data.rosterDropped === true,
    };
  } catch {
    return null;
  }
}
