"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import {
  SUPPORTED_GAMES_PER_TEAM,
  SUPPORTED_PLAYOFF_TEAM_COUNTS,
  SUPPORTED_SERIES_LENGTHS,
  SUPPORTED_TEAM_COUNTS,
  type GameSettings,
  type SeriesLength,
} from "@/domain/game-settings";
import {
  resetSettingsForPreset,
  settingsForPreset,
  type LeagueSetupPresetId,
} from "@/domain/game-settings-presets";
import { validateGameSettings } from "@/domain/game-settings-validation";
import { createSaveAction } from "@/application/actions";

type GameSetupFormProps = {
  atSaveLimit: boolean;
  defaultName?: string;
};

export function GameSetupForm({
  atSaveLimit,
  defaultName = "Harbor Franchise",
}: GameSetupFormProps) {
  const [preset, setPreset] = useState<LeagueSetupPresetId>("custom");
  const [settings, setSettings] = useState<GameSettings>(() =>
    settingsForPreset("custom"),
  );
  const [name, setName] = useState(defaultName);
  const [step, setStep] = useState<"configure" | "confirm">("configure");
  const [pending, startTransition] = useTransition();

  const validation = useMemo(
    () => validateGameSettings(settings),
    [settings],
  );
  const errors = validation.ok ? [] : validation.errors;
  const isCustom = preset === "custom";

  function applyPreset(next: LeagueSetupPresetId) {
    setPreset(next);
    setSettings(settingsForPreset(next, settings));
    setStep("configure");
  }

  function updateSettings(next: GameSettings) {
    setPreset("custom");
    setSettings(next);
  }

  function reset() {
    setSettings(resetSettingsForPreset(preset));
    setStep("configure");
  }

  function submit() {
    if (!validation.ok || atSaveLimit) {
      return;
    }
    const formData = new FormData();
    formData.set("name", name);
    formData.set("settingsJson", JSON.stringify(settings));
    startTransition(() => {
      void createSaveAction(formData);
    });
  }

  if (step === "confirm") {
    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <h2 className="text-xl font-medium text-zinc-100">Confirm setup</h2>
          <p className="text-sm text-zinc-400">
            Review your league rules before creating the franchise save.
          </p>
        </header>
        <dl className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm sm:grid-cols-2">
          <ReviewRow label="Save name" value={name} />
          <ReviewRow label="Preset" value={presetLabel(preset)} />
          <ReviewRow label="Teams" value={String(settings.league.teamCount)} />
          <ReviewRow
            label="Conferences"
            value={String(settings.league.conferenceCount)}
          />
          <ReviewRow
            label="Divisions"
            value={settings.league.divisionsEnabled ? "Enabled" : "Disabled"}
          />
          <ReviewRow
            label="League area"
            value={leagueAreaLabel(settings.league.area ?? "north_america")}
          />
          <ReviewRow
            label="Injuries"
            value={settings.injuriesEnabled ? "On" : "Off"}
          />
          <ReviewRow
            label="Games per team"
            value={String(settings.regularSeason.gamesPerTeam)}
          />
          <ReviewRow
            label="Playoff teams"
            value={String(settings.playoffs.playoffTeams)}
          />
          <ReviewRow
            label="Series length"
            value={`Best of ${settings.playoffs.seriesLength}`}
          />
          <ReviewRow
            label="Play-in"
            value={settings.playoffs.playInEnabled ? "On" : "Off"}
          />
          <ReviewRow
            label="Simulation"
            value={settings.simulation.frequency}
          />
          <ReviewRow label="AI difficulty" value={settings.ai.difficulty} />
          <ReviewRow label="Draft" value={settings.draft.mode} />
          {settings.draft.mode === "fantasy" ? (
            <ReviewRow
              label="Fantasy pick"
              value={settings.draft.randomizeUserPick
                ? "Randomized"
                : String(settings.draft.userPickPosition ?? "Not selected")}
            />
          ) : null}
          <ReviewRow
            label="League history"
            value={settings.history.mode === "generated" ? "Generated" : "New league"}
          />
          <ReviewRow
            label="Salary cap"
            value={settings.financialRules.salaryCapEnabled ? "On" : "Off"}
          />
          <ReviewRow
            label="Luxury tax"
            value={settings.financialRules.luxuryTaxEnabled ? "On" : "Off"}
          />
          <ReviewRow
            label="Revenue sharing"
            value={
              settings.financialRules.revenueSharingEnabled ? "On" : "Off"
            }
          />
        </dl>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setStep("configure")}
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-amber-600"
          >
            Back
          </button>
          <button
            type="button"
            disabled={pending || atSaveLimit || !validation.ok}
            onClick={submit}
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create franchise"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <label className="block text-sm text-zinc-300" htmlFor="save-name">
          Save name
        </label>
        <input
          id="save-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={atSaveLimit}
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-amber-500/40 focus:ring-2 disabled:opacity-50"
        />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-zinc-200">
          League configuration
        </legend>
        <p className="text-sm text-zinc-400">
          Build your league below, or start from an optional template.
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["custom", "Custom league"],
              ["standard", "Standard template — 30 / 82 / 16"],
              ["cbl", "CBL template — 12 / 22 / 8"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => applyPreset(id)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                preset === id
                  ? "bg-amber-600 text-zinc-950"
                  : "border border-zinc-700 text-zinc-300 hover:border-amber-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      {isCustom ? (
        <div className="space-y-6">
          <Section title="League">
            <SelectField
              label="Number of teams"
              value={settings.league.teamCount}
              options={SUPPORTED_TEAM_COUNTS.map((value) => ({
                value,
                label: String(value),
              }))}
              onChange={(value) =>
                updateSettings({
                  ...settings,
                  league: { ...settings.league, teamCount: value },
                })
              }
            />
            <SelectField
              label="Conferences"
              value={settings.league.conferenceCount}
              options={[
                { value: 1, label: "1 conference" },
                { value: 2, label: "2 conferences" },
              ]}
              onChange={(value) =>
                updateSettings({
                  ...settings,
                  league: { ...settings.league, conferenceCount: value },
                })
              }
            />
            <ToggleField
              label="Divisions"
              checked={settings.league.divisionsEnabled}
              onChange={(checked) =>
                updateSettings({
                  ...settings,
                  league: { ...settings.league, divisionsEnabled: checked },
                })
              }
            />
            <SelectField
              label="League area"
              value={leagueAreaIndex(settings.league.area ?? "north_america")}
              options={[
                { value: 0, label: "North America" },
                { value: 1, label: "Europe" },
                { value: 2, label: "Global" },
              ]}
              onChange={(value) =>
                updateSettings({
                  ...settings,
                  league: {
                    ...settings.league,
                    area: value === 0 ? "north_america" : value === 1 ? "europe" : "global",
                  },
                })
              }
            />
          </Section>

          <Section title="League rules">
            <ToggleField
              label="Injuries"
              checked={settings.injuriesEnabled}
              onChange={(checked) =>
                updateSettings({ ...settings, injuriesEnabled: checked })
              }
            />
          </Section>

          <Section title="Regular season">
            <SelectField
              label="Games per team"
              value={settings.regularSeason.gamesPerTeam}
              options={SUPPORTED_GAMES_PER_TEAM.map((value) => ({
                value,
                label: String(value),
              }))}
              onChange={(value) =>
                updateSettings({
                  ...settings,
                  regularSeason: {
                    ...settings.regularSeason,
                    gamesPerTeam: value,
                  },
                })
              }
            />
          </Section>

          <Section title="Playoffs">
            <SelectField
              label="Playoff teams"
              value={settings.playoffs.playoffTeams}
              options={SUPPORTED_PLAYOFF_TEAM_COUNTS.map((value) => ({
                value,
                label: String(value),
              }))}
              onChange={(value) =>
                updateSettings({
                  ...settings,
                  playoffs: { ...settings.playoffs, playoffTeams: value },
                })
              }
            />
            <SelectField
              label="Series length"
              value={settings.playoffs.seriesLength}
              options={SUPPORTED_SERIES_LENGTHS.map((value) => ({
                value,
                label: `Best of ${value}`,
              }))}
              onChange={(value) =>
                updateSettings({
                  ...settings,
                  playoffs: {
                    ...settings.playoffs,
                    seriesLength: value as SeriesLength,
                  },
                })
              }
            />
            <ToggleField
              label="Play-in tournament"
              checked={settings.playoffs.playInEnabled}
              onChange={(checked) =>
                updateSettings({
                  ...settings,
                  playoffs: { ...settings.playoffs, playInEnabled: checked },
                })
              }
            />
          </Section>

          <Section title="Simulation">
            <SelectField
              label="Advance frequency"
              value={settings.simulation.frequency === "daily" ? 0 : 1}
              options={[
                { value: 0, label: "Daily" },
                { value: 1, label: "Weekly" },
              ]}
              onChange={(value) =>
                updateSettings({
                  ...settings,
                  simulation: {
                    frequency: value === 0 ? "daily" : "weekly",
                  },
                })
              }
            />
          </Section>

          <Section title="AI">
            <SelectField
              label="Difficulty"
              value={
                settings.ai.difficulty === "easy"
                  ? 0
                  : settings.ai.difficulty === "normal"
                    ? 1
                    : 2
              }
              options={[
                { value: 0, label: "Easy" },
                { value: 1, label: "Normal" },
                { value: 2, label: "Hard" },
              ]}
              onChange={(value) =>
                updateSettings({
                  ...settings,
                  ai: {
                    difficulty:
                      value === 0 ? "easy" : value === 1 ? "normal" : "hard",
                  },
                })
              }
            />
          </Section>

          <Section title="Draft">
            <SelectField
              label="Startup draft"
              value={settings.draft.mode === "standard" ? 0 : 1}
              options={[
                { value: 0, label: "Standard rosters" },
                { value: 1, label: "Fantasy draft" },
              ]}
              onChange={(value) =>
                updateSettings({
                  ...settings,
                  draft: {
                    ...settings.draft,
                    mode: value === 0 ? "standard" : "fantasy",
                    userPickPosition:
                      value === 0 ? null : settings.draft.userPickPosition ?? 1,
                    randomizeUserPick: value === 0 ? false : settings.draft.randomizeUserPick,
                  },
                })
              }
            />
            {settings.draft.mode === "fantasy" ? (
              <>
                <SelectField
                  label="Your draft position"
                  value={settings.draft.userPickPosition ?? 1}
                  options={Array.from({ length: settings.league.teamCount }, (_, index) => ({
                    value: index + 1,
                    label: `Pick ${index + 1}`,
                  }))}
                  onChange={(value) =>
                    updateSettings({
                      ...settings,
                      draft: { ...settings.draft, userPickPosition: value },
                    })
                  }
                />
                <ToggleField
                  label="Randomize my draft position"
                  checked={settings.draft.randomizeUserPick}
                  onChange={(checked) =>
                    updateSettings({
                      ...settings,
                      draft: { ...settings.draft, randomizeUserPick: checked },
                    })
                  }
                />
              </>
            ) : null}
          </Section>

          <Section title="League history">
            <SelectField
              label="Starting world"
              value={settings.history.mode === "new" ? 0 : 1}
              options={[
                { value: 0, label: "Completely new league" },
                { value: 1, label: "Generate prior history" },
              ]}
              onChange={(value) =>
                updateSettings({
                  ...settings,
                  history: { mode: value === 0 ? "new" : "generated" },
                })
              }
            />
          </Section>

          <Section title="Financial rules">
            <ToggleField
              label="Salary cap"
              checked={settings.financialRules.salaryCapEnabled}
              onChange={(checked) =>
                updateSettings({
                  ...settings,
                  financialRules: {
                    ...settings.financialRules,
                    salaryCapEnabled: checked,
                  },
                })
              }
            />
            <ToggleField
              label="Luxury tax"
              checked={settings.financialRules.luxuryTaxEnabled}
              onChange={(checked) =>
                updateSettings({
                  ...settings,
                  financialRules: {
                    ...settings.financialRules,
                    luxuryTaxEnabled: checked,
                  },
                })
              }
            />
            <ToggleField
              label="Revenue sharing"
              checked={settings.financialRules.revenueSharingEnabled}
              onChange={(checked) =>
                updateSettings({
                  ...settings,
                  financialRules: {
                    ...settings.financialRules,
                    revenueSharingEnabled: checked,
                  },
                })
              }
            />
          </Section>
        </div>
      ) : (
        <p className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 text-sm text-zinc-400">
          {preset === "standard"
            ? "30 teams, 82 games, 16 playoff teams, best-of-7. Choose Custom to edit individual rules."
            : "12 teams, 22 games, 8 playoff teams, best-of-7 (classic CBL). Choose Custom to edit individual rules."}
        </p>
      )}

      {errors.length > 0 ? (
        <ul className="space-y-1 rounded-md border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-300">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-amber-600"
        >
          Reset to defaults
        </button>
        <button
          type="button"
          disabled={atSaveLimit || !validation.ok}
          onClick={() => setStep("confirm")}
          className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Review and create
        </button>
      </div>
    </div>
  );
}

function presetLabel(preset: LeagueSetupPresetId): string {
  if (preset === "standard") return "Standard";
  if (preset === "cbl") return "CBL";
  return "Custom";
}

function leagueAreaIndex(area: NonNullable<GameSettings["league"]["area"]>): number {
  return area === "north_america" ? 0 : area === "europe" ? 1 : 2;
}

function leagueAreaLabel(area: NonNullable<GameSettings["league"]["area"]>): string {
  return area === "north_america"
    ? "North America"
    : area === "europe"
      ? "Europe"
      : "Global";
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-zinc-800 p-4">
      <h3 className="text-sm font-medium text-zinc-100">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: Array<{ value: number; label: string }>;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-1 text-sm text-zinc-300">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-sm text-zinc-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 rounded border-zinc-600 bg-zinc-950 text-amber-600"
      />
      {label}
    </label>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium text-zinc-100">{value}</dd>
    </div>
  );
}
