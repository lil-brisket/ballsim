"use client";

import { updateFantasyDraftSettingsAction } from "@/application/actions";
import type { FantasyDraftView } from "@/state/selectors";
import { buttonClass } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function DraftSettingsPanel(props: {
  saveId: string;
  draft: FantasyDraftView;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 p-4">
      <SectionHeading title="Draft settings" className="mb-2" />
      <form action={updateFantasyDraftSettingsAction} className="text-sm">
        <input type="hidden" name="saveId" value={props.saveId} />
        <input
          type="hidden"
          name="confirmPicks"
          value={props.draft.settings.confirmPicks ? "false" : "true"}
        />
        <button type="submit" className={buttonClass({ variant: "secondary" })}>
          Confirm picks:{" "}
          <span className="font-semibold text-team-ink">
            {props.draft.settings.confirmPicks ? "ON" : "OFF"}
          </span>{" "}
          (click to toggle)
        </button>
      </form>
    </section>
  );
}
