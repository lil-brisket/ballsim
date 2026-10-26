"use client";

import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
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
import { SectionHeading } from "@/components/ui/SectionHeading";

type IdentityDraftMap = Record<string, ControlledFranchiseIdentityDraft>;

export type FranchisePickParticipant = {
  id: string;
  displayName: string;
  isHost: boolean;
  plannedTeamCount: number;
};

type FilterOption = {
  id: string;
  label: string;
};

function seedDraft(team: TeamListEntry): ControlledFranchiseIdentityDraft {
  const branding = team.branding;
  const logoId: TeamLogoId =
    branding && isTeamLogoId(branding.logoId) ? branding.logoId : "basketball";
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
  conferenceFilter: string | null,
): FilterOption[] {
  const scoped =
    conferenceFilter === null
      ? teams
      : teams.filter((team) => team.conferenceId === conferenceFilter);

  const byId = new Map<string, { name: string; conferenceName: string }>();
  for (const team of scoped) {
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
  // Only disambiguate when listing across conferences (All).
  const nameCounts = new Map<string, number>();
  if (conferenceFilter === null) {
    for (const entry of raw) {
      nameCounts.set(entry.name, (nameCounts.get(entry.name) ?? 0) + 1);
    }
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
    `inline-flex min-h-11 items-center rounded-full border px-3 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-team-ink ${
      active
        ? "border-team-ink text-team-ink"
        : "border-line-strong text-muted hover:border-faint"
    }`;

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-soft">{props.label}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={props.value === null}
          className={pillClass(props.value === null)}
          onClick={() => props.onChange(null)}
        >
          All
        </button>
        {props.options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={props.value === option.id}
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
  /** Local shared leagues: per-participant franchise assignment. */
  participants?: readonly FranchisePickParticipant[];
}) {
  const {
    saveId,
    anchorTeamId,
    controlledTeamCount,
    teams,
    divisionsEnabled = true,
    participants,
  } = props;
  const hostId =
    participants?.find((p) => p.isHost)?.id ?? participants?.[0]?.id;

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
  const [assignments, setAssignments] = useState<Record<string, string>>(() =>
    participants && hostId ? { [anchorTeamId]: hostId } : {},
  );
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
    () =>
      divisionsEnabled ? buildDivisionOptions(teams, conferenceFilter) : [],
    [teams, divisionsEnabled, conferenceFilter],
  );

  // Drop a division filter that no longer exists under the active conference.
  const activeDivisionFilter =
    divisionFilter !== null &&
    divisionOptions.some((option) => option.id === divisionFilter)
      ? divisionFilter
      : null;

  const showConferenceFilter =
    controlledTeamCount > 1 && conferenceOptions.length >= 2;
  const showDivisionFilter =
    controlledTeamCount > 1 && divisionsEnabled && divisionOptions.length >= 2;

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
      if (
        activeDivisionFilter !== null &&
        team.divisionId !== activeDivisionFilter
      ) {
        return false;
      }
      return true;
    });
  }, [
    sortedTeams,
    selectedIdSet,
    controlledTeamCount,
    conferenceFilter,
    activeDivisionFilter,
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

  const assignedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const id of selectedIds) {
      const owner = assignments[id];
      if (owner) {
        counts[owner] = (counts[owner] ?? 0) + 1;
      }
    }
    return counts;
  }, [selectedIds, assignments]);

  const assignmentsOk =
    !participants ||
    (selectedIds.every((id) => Boolean(assignments[id])) &&
      participants.every(
        (p) => (assignedCounts[p.id] ?? 0) === p.plannedTeamCount,
      ));

  const allValid =
    exactCount &&
    assignmentsOk &&
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
        setAssignments((prev) => {
          const next = { ...prev };
          delete next[teamId];
          return next;
        });
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
        if (participants) {
          const counts: Record<string, number> = {};
          for (const id of current) {
            const owner = assignments[id];
            if (owner) counts[owner] = (counts[owner] ?? 0) + 1;
          }
          const target = participants.find(
            (p) => (counts[p.id] ?? 0) < p.plannedTeamCount,
          );
          if (target) {
            setAssignments((prev) => ({ ...prev, [teamId]: target.id }));
          }
        }
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
          ...(participants ? { participantId: assignments[draft.teamId] } : {}),
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
          checked ? "border-team-ink/50 bg-surface-raised/40" : "border-line"
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
            className="mt-1 h-4 w-4 rounded border-disabled"
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
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line-strong"
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
              <span className="block text-sm text-muted">{team.city}</span>
              <span className="block text-sm font-semibold text-ink">
                {displayNickname}
                {isAnchor ? (
                  <span className="ml-2 text-sm font-normal text-muted">
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
                  className={`mt-1 block text-sm ${
                    identityComplete ? "text-win" : "text-faint"
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

        {checked && participants ? (
          <div className="px-3 pb-3">
            <label className="flex items-center gap-2 text-sm text-muted">
              <span>Managed by</span>
              <Select
                aria-label={`Managed by for ${team.city} ${team.name}`}
                value={assignments[team.id] ?? ""}
                disabled={isAnchor}
                onChange={(event) =>
                  setAssignments((prev) => ({
                    ...prev,
                    [team.id]: event.target.value,
                  }))
                }
              >
                {assignments[team.id] ? null : (
                  <option value="">Unassigned</option>
                )}
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                    {p.isHost ? " (host)" : ""}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        ) : null}

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
        <SectionHeading
          title={
            controlledTeamCount === 1
              ? "Customize your franchise"
              : `Select ${controlledTeamCount} franchises`
          }
        />
        <p className="mt-1 text-sm text-muted">
          {participants ? (
            <>
              Choose each player&apos;s franchises, then customize each
              team&apos;s identity. Generated names, colours, and logos are used
              as defaults.
            </>
          ) : (
            <>
              Select the franchises you want to control, then customize each
              team&apos;s identity. Generated names, colours, and logos are used
              as defaults.
            </>
          )}
        </p>
      </div>

      {controlledTeamCount > 1 ? (
        <div className="space-y-2 rounded-lg border border-line bg-surface-base/40 px-3 py-3">
          <SectionHeading
            as="h3"
            size="sm"
            tone="soft"
            title="Controlled Franchises"
          />
          <p className="text-sm text-soft">
            {selectedIds.length} of {controlledTeamCount}
          </p>
          <ul className="space-y-2">
            {pinnedTeams.map((team) => {
              const draft = drafts[team.id];
              const nickname = draft?.nickname ?? team.name;
              return (
                <li key={`summary-${team.id}`} className="text-sm">
                  <span className="text-ink">
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
            <SectionHeading as="h3" size="sm" tone="soft" title="Selected" />
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
                  onChange={(next) => {
                    setConferenceFilter(next);
                    setDivisionFilter(null);
                  }}
                />
              ) : null}
              {showDivisionFilter ? (
                <FilterPillRow
                  label="Division"
                  options={divisionOptions}
                  value={activeDivisionFilter}
                  onChange={setDivisionFilter}
                />
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <SectionHeading as="h3" size="sm" tone="soft" title="Franchises" />
            {availableTeams.length === 0 ? (
              <p className="text-sm text-faint">
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

      {participants ? (
        <p className="text-sm text-soft" data-testid="participant-progress">
          {participants
            .map(
              (p) =>
                `${p.displayName}${p.isHost ? " (host)" : ""}: ${assignedCounts[p.id] ?? 0} of ${p.plannedTeamCount}`,
            )
            .join(" · ")}
        </p>
      ) : null}

      {participants && exactCount && !assignmentsOk ? (
        <p role="status" className="text-sm text-muted">
          Each player needs exactly their planned number of franchises:{" "}
          {participants
            .filter((p) => (assignedCounts[p.id] ?? 0) !== p.plannedTeamCount)
            .map(
              (p) =>
                `${p.displayName} has ${assignedCounts[p.id] ?? 0} of ${p.plannedTeamCount}`,
            )
            .join(", ")}
          .
        </p>
      ) : null}

      {!exactCount ? (
        <p role="status" className="text-sm text-muted">
          Select {controlledTeamCount} franchise
          {controlledTeamCount === 1 ? "" : "s"} to continue (
          {selectedIds.length} selected).
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          variant="primary"
          aria-busy={pending}
          disabled={!allValid || pending}
          onClick={submit}
        >
          {pending
            ? "Saving…"
            : controlledTeamCount === 1
              ? "Continue to dashboard"
              : `Continue with ${controlledTeamCount} franchises`}
        </Button>
      </div>
    </div>
  );
}
