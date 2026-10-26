"use client";

import { useState, useTransition } from "react";
import {
  exportDraftClassAction,
  exportRosterAction,
} from "@/application/actions";
import { buttonClass } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/EmptyState";
import { SelectField } from "@/components/owner/game-setup/fields";

type ExportResult = { ok: true; json: string } | { ok: false; error: string };

function downloadJson(filename: string, json: string): void {
  const url = URL.createObjectURL(
    new Blob([json], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function ExportPanel(props: { saveId: string; draftYears: number[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [draftYear, setDraftYear] = useState<number | undefined>(
    props.draftYears[0],
  );

  function run(filename: string, request: () => Promise<ExportResult>) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await request();
        if (result.ok) {
          downloadJson(filename, result.json);
        } else {
          setError(result.error);
        }
      } catch {
        setError("Export failed.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {error ? <ErrorState message={error} /> : null}
      <div>
        <button
          type="button"
          disabled={pending}
          className={buttonClass({ variant: "secondary" })}
          onClick={() =>
            run(`roster-${props.saveId}.json`, () =>
              exportRosterAction(props.saveId),
            )
          }
        >
          Download roster (JSON)
        </button>
      </div>
      {draftYear !== undefined ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <SelectField
            label="Draft class year"
            value={draftYear}
            options={props.draftYears.map((year) => ({
              value: year,
              label: `${year}`,
            }))}
            onChange={setDraftYear}
          />
          <button
            type="button"
            disabled={pending}
            className={buttonClass({ variant: "secondary" })}
            onClick={() =>
              run(`draft-class-${draftYear}.json`, () =>
                exportDraftClassAction(props.saveId, draftYear),
              )
            }
          >
            Download draft class (JSON)
          </button>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">
          No draft class exists yet to export.
        </p>
      )}
    </div>
  );
}
