"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import {
  INJURY_FREQUENCIES,
  INJURY_FREQUENCY_LABELS,
  SUPPORTED_GAMES_PER_TEAM,
  SUPPORTED_PLAYOFF_TEAM_COUNTS,
  SUPPORTED_SERIES_LENGTHS,
  SUPPORTED_TEAM_COUNTS,
  LEAGUE_AREA_LABELS,
  LEAGUE_AREA_OPTIONS,
  maxControlledTeamCountForLeague,
  type GameSettings,
  type InjuryFrequency,
  type LeagueArea,
  type SeriesLength,
} from "@/domain/game-settings";
import {
  countDelegatedVisiblePhases,
  visibleDelegationPhaseCount,
} from "@/domain/ai-management-delegation";
import {
  resetSettingsForPreset,
  settingsForPreset,
  type LeagueSetupPresetId,
} from "@/domain/game-settings-presets";
import { validateGameSettings } from "@/domain/game-settings-validation";
import { createSaveAction } from "@/application/actions";
import { AiTeamManagementSection } from "@/components/owner/ai-management";
import { formatMoney } from "@/components/owner/MoneyDisplay";
import {
  DEFAULT_SALARY_CAP,
  MAX_SALARY_CAP,
  MIN_SALARY_CAP,
} from "@/systems/salary-cap-config";
import {
  DEFAULT_STAFF_BUDGET,
  MAX_STAFF_BUDGET,
  MIN_STAFF_BUDGET,
} from "@/systems/staff-budget-config";

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
    const max = maxControlledTeamCountForLeague(next.league.teamCount);
    const controlledTeamCount = Math.min(
      Math.max(1, next.ownership?.controlledTeamCount ?? 1),
      max,
    );
    setPreset("custom");
    setSettings({
      ...next,
      ownership: { controlledTeamCount },
    });
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
            label="Franchise control"
            value={
              settings.ownership.controlledTeamCount === 1
                ? "1 team"
                : `${settings.ownership.controlledTeamCount} teams`
            }
          />
          <ReviewRow
            label="Injury frequency"
            value={INJURY_FREQUENCY_LABELS[settings.injuryFrequency]}
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
            label="AI responsibilities"
            value={`${countDelegatedVisiblePhases(settings.ai.assistance)} of ${visibleDelegationPhaseCount()} delegated to AI`}
          />
          <ReviewRow label="Draft" value={settings.draft.mode} />
          {settings.draft.mode === "fantasy" ? (
            <ReviewRow
              label="Fantasy setup"
              value="Configured after franchise selection"
            />
          ) : null}
          <ReviewRow
            label="League history"
            value={settings.history.mode === "generated" ? "Generated" : "New league"}
          />
          <ReviewRow
            label="Player Salary Cap"
            value={
              settings.financialRules.salaryCapEnabled
                ? formatMoney(settings.financialRules.salaryCap)
                : "Off"
            }
          />
          <ReviewRow
            label="Staff Budget"
            value={formatMoney(settings.financialRules.staffBudget)}
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
              options={LEAGUE_AREA_OPTIONS.map((area, index) => ({
                value: index,
                label: LEAGUE_AREA_LABELS[area],
              }))}
              onChange={(value) =>
                updateSettings({
                  ...settings,
                  league: {
                    ...settings.league,
                    area: LEAGUE_AREA_OPTIONS[value] ?? "north_america",
                  },
                })
              }
            />
          </Section>

          <Section title="League rules">
            <div className="sm:col-span-2">
              <InjuryFrequencyField
                value={settings.injuryFrequency}
                onChange={(injuryFrequency) =>
                  updateSettings({ ...settings, injuryFrequency })
                }
              />
            </div>
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
          </Section>

          <Section title="AI">
            <div className="sm:col-span-2">
              <AiTeamManagementSection
                assistance={settings.ai.assistance}
                onAssistanceChange={(assistance) =>
                  updateSettings({
                    ...settings,
                    ai: {
                      ...settings.ai,
                      managementPreset: "custom",
                      assistance,
                    },
                  })
                }
              />
            </div>
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
                    type: settings.draft.type ?? "snake",
                    timerSeconds: settings.draft.timerSeconds ?? null,
                    orderMode: settings.draft.orderMode ?? "random",
                    userPickPosition: null,
                    randomizeUserPick: false,
                  },
                })
              }
            />
            {settings.draft.mode === "fantasy" ? (
              <p className="text-sm text-zinc-400">
                Draft order, timer, and snake/linear settings are configured after
                you choose your franchises.
              </p>
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
              label="Player Salary Cap enabled"
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
            <MoneyInputField
              label="Player Salary Cap"
              value={settings.financialRules.salaryCap}
              min={MIN_SALARY_CAP}
              max={MAX_SALARY_CAP}
              defaultValue={DEFAULT_SALARY_CAP}
              disabled={!settings.financialRules.salaryCapEnabled}
              onChange={(salaryCap) =>
                updateSettings({
                  ...settings,
                  financialRules: {
                    ...settings.financialRules,
                    salaryCap,
                  },
                })
              }
            />
            <MoneyInputField
              label="Staff Budget"
              value={settings.financialRules.staffBudget}
              min={MIN_STAFF_BUDGET}
              max={MAX_STAFF_BUDGET}
              defaultValue={DEFAULT_STAFF_BUDGET}
              onChange={(staffBudget) =>
                updateSettings({
                  ...settings,
                  financialRules: {
                    ...settings.financialRules,
                    staffBudget,
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

      <Section title="Franchise control">
        <div className="sm:col-span-2 space-y-3">
          <p className="text-sm text-zinc-400">
            Decide how many franchises you will control. You choose the specific
            teams after the league is generated.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                updateSettings({
                  ...settings,
                  ownership: { controlledTeamCount: 1 },
                })
              }
              className={`rounded-md px-3 py-1.5 text-sm ${
                settings.ownership.controlledTeamCount === 1
                  ? "bg-amber-600 text-zinc-950"
                  : "border border-zinc-700 text-zinc-300 hover:border-amber-600"
              }`}
            >
              Control 1 team
            </button>
            <button
              type="button"
              onClick={() => {
                const max = maxControlledTeamCountForLeague(
                  settings.league.teamCount,
                );
                const next = Math.min(
                  Math.max(2, settings.ownership.controlledTeamCount),
                  max,
                );
                updateSettings({
                  ...settings,
                  ownership: { controlledTeamCount: Math.max(2, next) },
                });
              }}
              className={`rounded-md px-3 py-1.5 text-sm ${
                settings.ownership.controlledTeamCount > 1
                  ? "bg-amber-600 text-zinc-950"
                  : "border border-zinc-700 text-zinc-300 hover:border-amber-600"
              }`}
            >
              Control multiple teams
            </button>
          </div>
          {settings.ownership.controlledTeamCount > 1 ? (
            <SelectField
              label="Number of controlled teams"
              value={settings.ownership.controlledTeamCount}
              options={Array.from(
                {
                  length: Math.max(
                    0,
                    maxControlledTeamCountForLeague(settings.league.teamCount) -
                      1,
                  ),
                },
                (_, index) => {
                  const value = index + 2;
                  return { value, label: String(value) };
                },
              )}
              onChange={(value) =>
                updateSettings({
                  ...settings,
                  ownership: { controlledTeamCount: value },
                })
              }
            />
          ) : null}
        </div>
      </Section>

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

function leagueAreaIndex(area: LeagueArea): number {
  const index = LEAGUE_AREA_OPTIONS.indexOf(area);
  return index >= 0 ? index : 0;
}

function leagueAreaLabel(area: LeagueArea): string {
  return LEAGUE_AREA_LABELS[area];
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

function MoneyInputField({
  label,
  value,
  min,
  max,
  defaultValue,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const millions = value / 1_000_000;
  return (
    <label className="block space-y-1 text-sm text-zinc-300 sm:col-span-2">
      <span className="font-medium text-zinc-200">
        {label} — {formatMoney(value)}
      </span>
      <p className="text-xs text-zinc-500">
        Range {formatMoney(min)}–{formatMoney(max)}. Default{" "}
        {formatMoney(defaultValue)}.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          disabled={disabled}
          min={min / 1_000_000}
          max={max / 1_000_000}
          step={1}
          value={Number.isFinite(millions) ? millions : ""}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === "") {
              return;
            }
            const parsed = Number(raw);
            if (!Number.isFinite(parsed)) {
              return;
            }
            const dollars = Math.round(parsed * 1_000_000);
            onChange(Math.min(max, Math.max(min, dollars)));
          }}
          className="w-32 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none ring-amber-500/40 focus:ring-2 disabled:opacity-50"
        />
        <span className="text-xs text-zinc-500">million dollars</span>
      </div>
    </label>
  );
}

function InjuryFrequencyField({
  value,
  onChange,
}: {
  value: InjuryFrequency;
  onChange: (value: InjuryFrequency) => void;
}) {
  const selectedIndex = INJURY_FREQUENCIES.indexOf(value);
  const selectedLabel = INJURY_FREQUENCY_LABELS[value];

  function setByIndex(index: number) {
    const next = INJURY_FREQUENCIES[Math.max(0, Math.min(2, index))];
    if (next) {
      onChange(next);
    }
  }

  return (
    <div className="space-y-2 text-sm text-zinc-300">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-medium text-zinc-200">
          Injury frequency — {selectedLabel}
        </span>
      </div>
      <p className="text-xs text-zinc-500">
        Affects how frequently players become injured during simulation.
      </p>
      <div
        role="radiogroup"
        aria-label={`Injury frequency — ${selectedLabel}`}
        className="flex rounded-md border border-zinc-700 bg-zinc-950 p-0.5"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            setByIndex(selectedIndex - 1);
          } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            setByIndex(selectedIndex + 1);
          } else if (event.key === "Home") {
            event.preventDefault();
            setByIndex(0);
          } else if (event.key === "End") {
            event.preventDefault();
            setByIndex(2);
          }
        }}
      >
        {INJURY_FREQUENCIES.map((frequency) => {
          const selected = frequency === value;
          return (
            <button
              key={frequency}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(frequency)}
              className={`flex-1 rounded px-3 py-2 text-center text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
                selected
                  ? "bg-amber-600 font-medium text-zinc-950"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              {INJURY_FREQUENCY_LABELS[frequency]}
            </button>
          );
        })}
      </div>
    </div>
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
