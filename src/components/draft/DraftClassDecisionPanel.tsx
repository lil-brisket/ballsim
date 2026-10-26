"use client";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { buttonClass } from "@/components/ui/Button";
import { useState, useTransition } from "react";
import { resolveDraftClassDecisionAction } from "@/application/actions";
import { ErrorState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
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
    <div className="space-y-4 rounded-lg border border-line bg-surface-base/60 p-4">
      <header className="space-y-1">
        <SectionHeading
          as="h3"
          title={`Prepare the ${props.draftYear} Draft Class`}
        />
        <p className="text-sm text-muted">
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
          className={buttonClass({ variant: "primary" })}
        >
          Use Generated Class
        </button>
      </form>
      <div className="space-y-3 border-t border-line pt-4">
        <label className="block text-sm text-soft">
          Import custom class
          <input
            type="file"
            accept="application/json,.json"
            className="mt-2 block w-full text-sm text-muted file:mr-3 file:rounded-md file:border file:border-line-strong file:bg-surface-raised file:px-3 file:py-1.5 file:text-ink"
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
            className={buttonClass({ variant: "secondary" })}
          >
            Import Custom Class
          </button>
        </form>
        <button
          type="button"
          disabled
          title="Community library coming soon"
          className={buttonClass({ variant: "secondary" })}
        >
          Choose Community Class
        </button>
        <p className="text-sm text-faint">Community library coming soon.</p>
      </div>
    </div>
  );
}
