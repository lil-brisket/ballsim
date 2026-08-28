"use client";

import { useMemo, useState, useTransition } from "react";
import { confirmControlledFranchisesAction } from "@/application/actions";
import {
  ControlledFranchiseIdentityEditor,
  type ControlledFranchiseIdentityDraft,
} from "@/components/owner/ControlledFranchiseIdentityEditor";
import { TeamLeaguePlacement } from "@/components/owner/TeamLeaguePlacement";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import type { TeamLogoId } from "@/data/team-branding/logo-catalog";
import { isTeamLogoId } from "@/data/team-branding/logo-catalog";
import {
  normalizeHexColor,
  validateTeamBranding,
} from "@/domain/entities/team-branding";
import { validateTeamNickname } from "@/domain/team-nickname";
import type { TeamListEntry } from "@/state/selectors";

type IdentityDraftMap = Record<string, ControlledFranchiseIdentityDraft>;

type FilterOption = {
  id: string;
  label: string;
};

function seedDraft(team: TeamListEntry): ControlledFranchiseIdentityDraft {
  const branding = team.branding;
  const logoId: TeamLogoId =
    branding && isTeamLogoId(branding.logoId)
      ? branding.logoId
      : "basketball";
  return {
    teamId: team.id,
    city: team.city,
    abbreviation: team.abbreviation,
    nickname: team.name,
    primaryColor: normalizeHexColor(branding?.primaryColor ?? "#1d4ed8"),
    secondaryColor: normalizeHexColor(branding?.secondaryColor ?? "#f8fafc"),
    accentColor: normalizeHexColor(branding?.accentColor ?? "#f59e0b"),
    logoId,
  };
}

function isDraftValid(
  draft: ControlledFranchiseIdentityDraft,
  teams: readonly TeamListEntry[],
  selectedDrafts: readonly ControlledFranchiseIdentityDraft[],
): { ok: true } | { ok: false; error: string } {
  const nick = validateTeamNickname(draft.nickname, {
    city: draft.city,
    existingTeams: teams.map((team) => ({
      id: team.id,
      city: team.city,
      name: team.name,
    })),
    excludeTeamId: draft.teamId,
  });
  if (!nick.ok) {
    return nick;
  }
  for (const other of selectedDrafts) {
    if (
      other.teamId !== draft.teamId &&
      other.nickname.toLowerCase() === nick.value.toLowerCase()
    ) {
      return {
        ok: false,
        error: `Nickname "${nick.value}" is used by another controlled franchise.`,
      };
    }
  }
  const branding = validateTeamBranding({
    primaryColor: draft.primaryColor,
    secondaryColor: draft.secondaryColor,
    accentColor: draft.accentColor,
    logoId: draft.logoId,
  });
  if (!branding.ok) {
    return branding;
  }
  return { ok: true };
}

function buildConferenceOptions(
  teams: readonly TeamListEntry[],
): FilterOption[] {
  const byId = new Map<string, string>();
  for (const team of teams) {
    if (!byId.has(team.conferenceId) && team.conferenceName) {
      byId.set(team.conferenceId, team.conferenceName);
    }
  }
  return [...byId.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function buildDivisionOptions(
  teams: readonly TeamListEntry[],
): FilterOption[] {
  const byId = new Map<
    string,
    { name: string; conferenceName: string }
  >();
  for (const team of teams) {
    if (!byId.has(team.divisionId) && team.divisionName) {
      byId.set(team.divisionId, {
        name: team.divisionName,
        conferenceName: team.conferenceName,
      });
    }
  }
  const raw = [...byId.entries()].map(([id, info]) => ({
    id,
    name: info.name,
    conferenceName: info.conferenceName,
  }));
  const nameCounts = new Map<string, number>();
  for (const entry of raw) {
    nameCounts.set(entry.name, (nameCounts.get(entry.name) ?? 0) + 1);
  }
  return raw
    .map((entry) => ({
      id: entry.id,
      label:
        (nameCounts.get(entry.name) ?? 0) > 1
          ? `${entry.name} (${entry.conferenceName})`
          : entry.name,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function FilterPillRow(props: {
  label: string;
  options: readonly FilterOption[];
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const pillClass = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs ${
      active
        ? "border-amber-600 text-amber-400"
        : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
    }`;

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        {props.label}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={pillClass(props.value === null)}
          onClick={() => props.onChange(null)}
        >
          All
        </button>
        {props.options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={pillClass(props.value === option.id)}
            onClick={() => props.onChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Controlled franchise selection + identity setup during onboarding.
 * Anchor franchise (post city pick) is locked; user selects exactly controlledTeamCount.
 * Selected franchises stay pinned above filters so identity editing is never lost.
 */
export function OwnerMultiTeamPick(props: {
  saveId: string;
  anchorTeamId: string;
  controlledTeamCount: number;
  teams: readonly TeamListEntry[];
  divisionsEnabled?: boolean;
}) {
  const {
    saveId,
    anchorTeamId,
    controlledTeamCount,
    teams,
    divisionsEnabled = true,
  } = props;

  const sortedTeams = useMemo(
    () =>
      [...teams].sort((a, b) => {
        if (a.id === anchorTeamId) return -1;
        if (b.id === anchorTeamId) return 1;
        return `${a.city} ${a.name}`.localeCompare(`${b.city} ${b.name}`);
      }),
    [teams, anchorTeamId],
  );

  const [selectedIds, setSelectedIds] = useState<string[]>(() => [
    anchorTeamId,
  ]);
  const [drafts, setDrafts] = useState<IdentityDraftMap>(() => {
    const anchor = teams.find((team) => team.id === anchorTeamId);
    return anchor ? { [anchorTeamId]: seedDraft(anchor) } : {};
  });
  const [expandedId, setExpandedId] = useState<string | null>(anchorTeamId);
  const [conferenceFilter, setConferenceFilter] = useState<string | null>(null);
  const [divisionFilter, setDivisionFilter] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const conferenceOptions = useMemo(
    () => buildConferenceOptions(teams),
    [teams],
  );
  const divisionOptions = useMemo(
    () => (divisionsEnabled ? buildDivisionOptions(teams) : []),
    [teams, divisionsEnabled],
  );

  const showConferenceFilter =
    controlledTeamCount > 1 && conferenceOptions.length >= 2;
  const showDivisionFilter =
    controlledTeamCount > 1 &&
    divisionsEnabled &&
    divisionOptions.length >= 2;

  const pinnedTeams = useMemo(
    () => sortedTeams.filter((team) => selectedIdSet.has(team.id)),
    [sortedTeams, selectedIdSet],
  );

  const availableTeams = useMemo(() => {
    if (controlledTeamCount === 1) {
      return [];
    }
    return sortedTeams.filter((team) => {
      if (selectedIdSet.has(team.id)) {
        return false;
      }
      if (conferenceFilter !== null && team.conferenceId !== conferenceFilter) {
        return false;
      }
      if (divisionFilter !== null && team.divisionId !== divisionFilter) {
        return false;
      }
      return true;
    });
  }, [
    sortedTeams,
    selectedIdSet,
    controlledTeamCount,
    conferenceFilter,
    divisionFilter,
  ]);

  const selectedDrafts = useMemo(
    () =>
      selectedIds
        .map((id) => drafts[id])
        .filter((draft): draft is ControlledFranchiseIdentityDraft =>
          Boolean(draft),
        ),
    [selectedIds, drafts],
  );

  const validationById = useMemo(() => {
    const map: Record<string, { ok: true } | { ok: false; error: string }> = {};
    for (const id of selectedIds) {
      const draft = drafts[id];
      if (!draft) {
        map[id] = { ok: false, error: "Missing identity draft." };
        continue;
      }
      map[id] = isDraftValid(draft, teams, selectedDrafts);
    }
    return map;
  }, [selectedIds, drafts, teams, selectedDrafts]);

  const exactCount = selectedIds.length === controlledTeamCount;
  const allValid =
    exactCount &&
    selectedIds.every((id) => validationById[id]?.ok === true);

  function ensureDraft(team: TeamListEntry): ControlledFranchiseIdentityDraft {
    return drafts[team.id] ?? seedDraft(team);
  }

  function toggle(teamId: string) {
    if (teamId === anchorTeamId) {
      return;
    }
    setSelectedIds((current) => {
      if (current.includes(teamId)) {
        if (expandedId === teamId) {
          setExpandedId(anchorTeamId);
        }
        return current.filter((id) => id !== teamId);
      }
      if (current.length >= controlledTeamCount) {
        return current;
      }
      const team = teams.find((entry) => entry.id === teamId);
      if (team) {
        setDrafts((prev) => ({
          ...prev,
          [teamId]: prev[teamId] ?? seedDraft(team),
        }));
        setExpandedId(teamId);
      }
      return [...current, teamId];
    });
  }

  function updateDraft(next: ControlledFranchiseIdentityDraft) {
    setDrafts((prev) => ({ ...prev, [next.teamId]: next }));
  }

  function submit() {
    if (!allValid) {
      return;
    }
    const formData = new FormData();
    formData.set("saveId", saveId);
    formData.set(
      "franchisesJson",
      JSON.stringify(
        selectedDrafts.map((draft) => ({
          teamId: draft.teamId,
          nickname: draft.nickname,
          primaryColor: draft.primaryColor,
          secondaryColor: draft.secondaryColor,
          accentColor: draft.accentColor,
          logoId: draft.logoId,
        })),
      ),
    );
    startTransition(() => {
      void confirmControlledFranchisesAction(formData);
    });
  }

  function renderFranchiseCard(team: TeamListEntry) {
    const isAnchor = team.id === anchorTeamId;
    const checked = selectedIdSet.has(team.id);
    const draft = checked ? ensureDraft(team) : null;
    const expanded = checked && expandedId === team.id;
    const validation = checked ? validationById[team.id] : null;
    const identityComplete = validation?.ok === true;
    const displayNickname = draft?.nickname ?? team.name;

    return (
      <li
        key={team.id}
        className={`rounded-lg border ${
          checked ? "border-amber-700/50 bg-zinc-900/40" : "border-zinc-800"
        }`}
      >
        <div className="flex items-start gap-3 px-3 py-3">
          <input
            type="checkbox"
            checked={checked}
            disabled={
              isAnchor ||
              (!checked && selectedIds.length >= controlledTeamCount)
            }
            onChange={() => toggle(team.id)}
            className="mt-1 h-4 w-4 rounded border-zinc-600"
            aria-label={`Control ${team.city} ${team.name}`}
          />
          <button
            type="button"
            className="flex min-w-0 flex-1 items-start gap-3 text-left"
            onClick={() => {
              if (!checked) {
                toggle(team.id);
                return;
              }
              setExpandedId((current) =>
                current === team.id ? null : team.id,
              );
            }}
          >
            {(draft ?? team.branding) ? (
              <span
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-700"
                style={{
                  backgroundColor:
                    draft?.primaryColor ??
                    team.branding?.primaryColor ??
                    "#27272a",
                }}
              >
                <TeamLogoMark
                  branding={{
                    primaryColor:
                      draft?.primaryColor ??
                      team.branding?.primaryColor ??
                      "#1d4ed8",
                    secondaryColor:
                      draft?.secondaryColor ??
                      team.branding?.secondaryColor ??
                      "#f8fafc",
                    accentColor:
                      draft?.accentColor ??
                      team.branding?.accentColor ??
                      "#f59e0b",
                    logoId:
                      draft?.logoId ??
                      (team.branding && isTeamLogoId(team.branding.logoId)
                        ? team.branding.logoId
                        : "basketball"),
                  }}
                  size="sm"
                  title={`${team.city} ${displayNickname}`}
                />
              </span>
            ) : null}
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-zinc-400">{team.city}</span>
              <span className="block text-sm font-semibold text-zinc-100">
                {displayNickname}
                {isAnchor ? (
                  <span className="ml-2 text-xs font-normal text-amber-500">
                    Initial
                  </span>
                ) : null}
              </span>
              <TeamLeaguePlacement
                conferenceName={team.conferenceName}
                divisionName={team.divisionName}
                showDivision={divisionsEnabled}
              />
              {checked ? (
                <span
                  className={`mt-1 block text-xs ${
                    identityComplete ? "text-emerald-400" : "text-amber-500"
                  }`}
                >
                  {identityComplete
                    ? "Identity complete"
                    : "Identity incomplete"}
                </span>
              ) : null}
            </span>
          </button>
        </div>

        {expanded && draft ? (
          <div className="px-3 pb-3">
            <ControlledFranchiseIdentityEditor
              draft={draft}
              nicknameError={
                validation && !validation.ok ? validation.error : null
              }
              onChange={updateDraft}
            />
          </div>
        ) : null}
      </li>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium text-zinc-100">
          {controlledTeamCount === 1
            ? "Customize your franchise"
            : `Select ${controlledTeamCount} franchises`}
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Select the franchises you want to control, then customize each team&apos;s
          identity. Generated names, colours, and logos are used as defaults.
        </p>
      </div>

      {controlledTeamCount > 1 ? (
        <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Controlled Franchises
          </p>
          <p className="text-sm text-zinc-300">
            {selectedIds.length} of {controlledTeamCount}
          </p>
          <ul className="space-y-2">
            {pinnedTeams.map((team) => {
              const draft = drafts[team.id];
              const nickname = draft?.nickname ?? team.name;
              return (
                <li key={`summary-${team.id}`} className="text-sm">
                  <span className="text-zinc-100">
                    ✓ {team.city} {nickname}
                  </span>
                  <TeamLeaguePlacement
                    conferenceName={team.conferenceName}
                    divisionName={team.divisionName}
                    showDivision={divisionsEnabled}
                    compact
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {controlledTeamCount === 1 ? (
        <ul className="space-y-2">{pinnedTeams.map(renderFranchiseCard)}</ul>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Selected
            </p>
            <ul className="space-y-2">
              {pinnedTeams.map(renderFranchiseCard)}
            </ul>
          </div>

          {showConferenceFilter || showDivisionFilter ? (
            <div className="space-y-3">
              {showConferenceFilter ? (
                <FilterPillRow
                  label="Conference"
                  options={conferenceOptions}
                  value={conferenceFilter}
                  onChange={setConferenceFilter}
                />
              ) : null}
              {showDivisionFilter ? (
                <FilterPillRow
                  label="Division"
                  options={divisionOptions}
                  value={divisionFilter}
                  onChange={setDivisionFilter}
                />
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Franchises
            </p>
            {availableTeams.length === 0 ? (
              <p className="text-sm text-zinc-500">
                {selectedIds.length >= controlledTeamCount
                  ? "Selection limit reached. Deselect a franchise to choose another."
                  : "No franchises match the current filters."}
              </p>
            ) : (
              <ul className="space-y-2">
                {availableTeams.map(renderFranchiseCard)}
              </ul>
            )}
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!allValid || pending}
          onClick={submit}
          className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending
            ? "Saving…"
            : controlledTeamCount === 1
              ? "Continue to dashboard"
              : `Continue with ${controlledTeamCount} franchises`}
        </button>
      </div>
    </div>
  );
}
