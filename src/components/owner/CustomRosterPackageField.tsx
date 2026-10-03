"use client";

import { useMemo, useState } from "react";
import { ErrorState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import {
  parseCustomContentJson,
  validateRosterPackage,
  type ImportValidationResult,
  type RosterPackage,
} from "@/systems/custom-content";

export function CustomRosterPackageField(props: {
  teamCount: number;
  salaryCap?: number;
  salaryCapEnabled?: boolean;
  packageJson: string;
  onPackageJsonChange: (value: string) => void;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const preview = useMemo((): ImportValidationResult<RosterPackage> | null => {
    if (props.packageJson.length === 0) {
      return null;
    }
    const parsed = parseCustomContentJson(props.packageJson);
    if (!parsed.ok || parsed.normalized === undefined) {
      return parsed as ImportValidationResult<RosterPackage>;
    }
    return validateRosterPackage(parsed.normalized, {
      teamCount: props.teamCount,
      schemaVersion: GAME_STATE_SCHEMA_VERSION,
      salaryCap: props.salaryCap,
      salaryCapEnabled: props.salaryCapEnabled,
    });
  }, [
    props.packageJson,
    props.teamCount,
    props.salaryCap,
    props.salaryCapEnabled,
  ]);

  const teamCount = preview?.normalized?.payload.teams.length ?? 0;
  const playerCount = preview?.normalized?.payload.players.length ?? 0;
  const errorCount = preview?.errors.length ?? 0;
  const warningCount = preview?.warnings.length ?? 0;

  return (
    <div className="space-y-3">
      <label className="block text-sm text-zinc-300">
        Custom roster package
        <input
          type="file"
          accept="application/json,.json"
          className="mt-2 block w-full text-sm text-zinc-400 file:mr-3 file:rounded-md file:border file:border-zinc-700 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-zinc-200"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) {
              setFileName(null);
              props.onPackageJsonChange("");
              return;
            }
            setFileName(file.name);
            const reader = new FileReader();
            reader.onload = () => {
              props.onPackageJsonChange(String(reader.result ?? ""));
            };
            reader.readAsText(file);
          }}
        />
      </label>
      {fileName ? (
        <p className="text-xs text-zinc-500">Selected: {fileName}</p>
      ) : (
        <p className="text-xs text-zinc-500">Upload a JSON roster package.</p>
      )}
      {preview ? (
        <div className="space-y-2 rounded-md border border-zinc-800 bg-zinc-950/60 p-3 text-sm">
          <p className="text-zinc-200">
            {teamCount} teams · {playerCount} players
          </p>
          <div className="flex flex-wrap gap-2">
            <StatusBadge
              label={`${errorCount} errors`}
              tone={errorCount > 0 ? "critical" : "success"}
            />
            <StatusBadge
              label={`${warningCount} warnings`}
              tone={warningCount > 0 ? "warning" : "info"}
            />
          </div>
          {preview.errors.length > 0 ? (
            <ul className="space-y-1">
              {preview.errors.map((entry) => (
                <li key={`${entry.path}:${entry.code}`}>
                  <ErrorState message={`${entry.path}: ${entry.message}`} />
                </li>
              ))}
            </ul>
          ) : null}
          {preview.warnings.length > 0 ? (
            <details className="text-amber-200">
              <summary className="cursor-pointer text-xs">
                Show {preview.warnings.length} warnings
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-100/90">
                {preview.warnings.map((entry) => (
                  <li key={`${entry.path}:${entry.code}`}>
                    {entry.path}: {entry.message}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function customRosterHasErrors(
  packageJson: string,
  teamCount: number,
  salaryCap?: number,
  salaryCapEnabled?: boolean,
): boolean {
  if (packageJson.length === 0) {
    return true;
  }
  const parsed = parseCustomContentJson(packageJson);
  if (!parsed.ok || parsed.normalized === undefined) {
    return true;
  }
  const result = validateRosterPackage(parsed.normalized, {
    teamCount,
    schemaVersion: GAME_STATE_SCHEMA_VERSION,
    salaryCap,
    salaryCapEnabled,
  });
  return !result.ok;
}
