"use client";

import {
  assignToDevelopmentLeagueAction,
  recallFromDevelopmentLeagueAction,
} from "@/application/actions";

export function DevelopmentLeaguePlayerActions(props: {
  saveId: string;
  playerId: string;
  returnPath: string;
  canAssign: boolean;
  canRecall: boolean;
  statusLabel: string | null;
  readinessLabel: string | null;
  whyBullets: string[];
}) {
  if (!props.canAssign && !props.canRecall && props.statusLabel == null) {
    return null;
  }

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <h3 className="text-sm font-semibold text-zinc-100">
        Development League
      </h3>
      {props.statusLabel ? (
        <p className="mt-1 text-xs text-zinc-400">
          Status: {props.statusLabel}
          {props.readinessLabel ? ` · ${props.readinessLabel}` : ""}
        </p>
      ) : null}
      {props.whyBullets.length > 0 ? (
        <ul className="mt-2 list-disc pl-4 text-xs text-zinc-500">
          {props.whyBullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {props.canAssign ? (
          <form action={assignToDevelopmentLeagueAction}>
            <input type="hidden" name="saveId" value={props.saveId} />
            <input type="hidden" name="playerId" value={props.playerId} />
            <input type="hidden" name="returnPath" value={props.returnPath} />
            <button
              type="submit"
              className="rounded border border-amber-600 bg-amber-950/40 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-900/50"
            >
              Send to Development League
            </button>
          </form>
        ) : null}
        {props.canRecall ? (
          <form action={recallFromDevelopmentLeagueAction}>
            <input type="hidden" name="saveId" value={props.saveId} />
            <input type="hidden" name="playerId" value={props.playerId} />
            <input type="hidden" name="returnPath" value={props.returnPath} />
            <button
              type="submit"
              className="rounded border border-zinc-600 px-3 py-1.5 text-xs text-zinc-100 hover:border-amber-500"
            >
              Recall to Top League
            </button>
          </form>
        ) : null}
      </div>
    </section>
  );
}
