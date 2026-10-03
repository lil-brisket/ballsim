"use client";

import { useState, useTransition } from "react";
import { resolveDraftClassDecisionAction } from "@/application/actions";
import { ErrorState } from "@/components/owner/EmptyState";
import { StatusBadge } from "@/components/owner/StatusBadge";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import {
  parseCustomContentJson,
  validateDraftClassPackage,
} from "@/systems/custom-content";

export function DraftClassDecisionPanel(props: {
  saveId: string;
  draftYear: number;
  seasonYear: number;
  returnPath: string;
}) {
  const [packageJson, setPackageJson] = useState("");
  const [pending, startTransition] = useTransition();
  const parsed =
    packageJson.length === 0 ? null : parseCustomContentJson(packageJson);
  const preview =
    parsed === null || parsed.normalized === undefined
      ? parsed
      : validateDraftClassPackage(parsed.normalized, {
          schemaVersion: GAME_STATE_SCHEMA_VERSION,
          seasonYear: props.seasonYear,
          draftHorizonYear: props.seasonYear + 3,
        });
  const hasErrors = preview !== null && !preview.ok;

  return (
    <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
      <header className="space-y-1">
        <h3 className="text-lg font-medium text-zinc-100">
          Prepare the {props.draftYear} Draft Class
        </h3>
        <p className="text-sm text-zinc-400">
          The league can generate a fictional rookie class automatically, or you
          can import a custom class.
        </p>
      </header>
      <form
        className="flex flex-wrap gap-2"
        action={(formData) => {
          startTransition(() => {
            void resolveDraftClassDecisionAction(formData);
          });
        }}
      >
        <input type="hidden" name="saveId" value={props.saveId} />
        <input type="hidden" name="returnPath" value={props.returnPath} />
        <input type="hidden" name="source" value="generated" />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500 disabled:opacity-50"
        >
          Use Generated Class
        </button>
      </form>
      <div className="space-y-3 border-t border-zinc-800 pt-4">
        <label className="block text-sm text-zinc-300">
          Import custom class
          <input
            type="file"
            accept="application/json,.json"
            className="mt-2 block w-full text-sm text-zinc-400 file:mr-3 file:rounded-md file:border file:border-zinc-700 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-zinc-200"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) {
                setPackageJson("");
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                setPackageJson(String(reader.result ?? ""));
              };
              reader.readAsText(file);
            }}
          />
        </label>
        {preview ? (
          <div className="space-y-2 text-sm">
            <StatusBadge
              label={`${preview.errors.length} errors`}
              tone={preview.errors.length > 0 ? "critical" : "success"}
            />
            {preview.warnings.length > 0 ? (
              <StatusBadge
                label={`${preview.warnings.length} warnings`}
                tone="warning"
              />
            ) : null}
            {preview.errors.map((entry) => (
              <ErrorState
                key={`${entry.path}:${entry.code}`}
                message={`${entry.path}: ${entry.message}`}
              />
            ))}
          </div>
        ) : null}
        <form
          action={(formData) => {
            startTransition(() => {
              void resolveDraftClassDecisionAction(formData);
            });
          }}
        >
          <input type="hidden" name="saveId" value={props.saveId} />
          <input type="hidden" name="returnPath" value={props.returnPath} />
          <input type="hidden" name="source" value="custom" />
          <input type="hidden" name="packageJson" value={packageJson} />
          <button
            type="submit"
            disabled={pending || packageJson.length === 0 || hasErrors}
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Import Custom Class
          </button>
        </form>
        <button
          type="button"
          disabled
          title="Community library coming soon"
          className="rounded-md border border-zinc-800 px-4 py-2 text-sm text-zinc-500 disabled:cursor-not-allowed"
        >
          Choose Community Class
        </button>
        <p className="text-xs text-zinc-500">Community library coming soon.</p>
      </div>
    </div>
  );
}
