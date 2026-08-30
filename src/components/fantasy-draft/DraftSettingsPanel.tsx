"use client";

import { updateFantasyDraftSettingsAction } from "@/application/actions";
import type { FantasyDraftView } from "@/state/selectors";

export function DraftSettingsPanel(props: {
  saveId: string;
  draft: FantasyDraftView;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 p-4">
      <h2 className="mb-2 text-sm font-semibold uppercase text-zinc-400">
        Draft settings
      </h2>
      <form action={updateFantasyDraftSettingsAction} className="text-sm">
        <input type="hidden" name="saveId" value={props.saveId} />
        <input
          type="hidden"
          name="confirmPicks"
          value={props.draft.settings.confirmPicks ? "false" : "true"}
        />
        <button
          type="submit"
          className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
        >
          Confirm picks:{" "}
          <span className="font-semibold text-amber-300">
            {props.draft.settings.confirmPicks ? "ON" : "OFF"}
          </span>{" "}
          (click to toggle)
        </button>
      </form>
    </section>
  );
}
