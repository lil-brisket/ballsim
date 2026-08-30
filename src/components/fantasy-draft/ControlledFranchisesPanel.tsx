import {
  switchActiveOwnerTeamAction,
  toggleFantasyDraftAutoPickAction,
} from "@/application/actions";
import type { FantasyDraftView } from "@/state/selectors";

export function ControlledFranchisesPanel(props: {
  saveId: string;
  draft: FantasyDraftView;
}) {
  const { saveId, draft } = props;

  return (
    <section className="rounded-xl border border-zinc-800 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Controlled franchises
      </h2>
      <ul className="space-y-2">
        {draft.controlledFranchises.map((team) => (
          <li
            key={team.teamId}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
              team.isActive
                ? "border-amber-700/60 bg-amber-950/20"
                : "border-zinc-800"
            }`}
          >
            <div className="min-w-0">
              <div className="font-medium text-zinc-100">
                {team.teamName}
                {team.isActive ? (
                  <span className="ml-2 text-xs text-amber-400">Active</span>
                ) : null}
              </div>
              <div className="mt-0.5 text-xs text-zinc-500">
                {team.isOnClock ? (
                  <span className="font-semibold text-amber-300">ON CLOCK</span>
                ) : team.nextPickNumber != null ? (
                  <>Pick #{team.nextPickNumber}</>
                ) : (
                  "No remaining picks"
                )}
                <span className="mx-1.5 text-zinc-700">·</span>
                {team.autoPick ? "Auto-pick" : "Manual"}
              </div>
            </div>
            <span className="flex gap-2">
              {!team.isActive ? (
                <form action={switchActiveOwnerTeamAction}>
                  <input type="hidden" name="saveId" value={saveId} />
                  <input type="hidden" name="teamId" value={team.teamId} />
                  <input
                    type="hidden"
                    name="returnPath"
                    value={`/fantasy-draft/${saveId}`}
                  />
                  <button
                    type="submit"
                    className="rounded border border-zinc-700 px-2 py-1 text-xs hover:border-zinc-500"
                  >
                    Switch
                  </button>
                </form>
              ) : null}
              <form action={toggleFantasyDraftAutoPickAction}>
                <input type="hidden" name="saveId" value={saveId} />
                <input type="hidden" name="teamId" value={team.teamId} />
                <input
                  type="hidden"
                  name="enabled"
                  value={team.autoPick ? "false" : "true"}
                />
                <button
                  type="submit"
                  className="rounded border border-zinc-700 px-2 py-1 text-xs hover:border-zinc-500"
                >
                  {team.autoPick ? "Auto ON" : "Manual"}
                </button>
              </form>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
