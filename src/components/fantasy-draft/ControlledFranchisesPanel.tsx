import {
  switchActiveOwnerTeamAction,
  toggleFantasyDraftAutoPickAction,
} from "@/application/actions";
import type { FantasyDraftView } from "@/state/selectors";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { buttonClass } from "@/components/ui/Button";

export function ControlledFranchisesPanel(props: {
  saveId: string;
  draft: FantasyDraftView;
}) {
  const { saveId, draft } = props;

  return (
    <section className="rounded-xl border border-line p-4">
      <SectionHeading title="Controlled franchises" className="mb-3" />
      <ul className="space-y-2">
        {draft.controlledFranchises.map((team) => (
          <li
            key={team.teamId}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
              team.isActive ? "border-team-ink/50 bg-team/20" : "border-line"
            }`}
          >
            <div className="min-w-0">
              <div className="font-medium text-ink">
                {team.teamName}
                {team.isActive ? (
                  <span className="ml-2 text-sm text-team-ink">Active</span>
                ) : null}
              </div>
              <div className="mt-0.5 text-sm text-faint">
                {team.isOnClock ? (
                  <span className="font-semibold text-team-ink">ON CLOCK</span>
                ) : team.nextPickNumber != null ? (
                  <>Pick #{team.nextPickNumber}</>
                ) : (
                  "No remaining picks"
                )}
                <span className="mx-1.5 text-line-strong">·</span>
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
                    className={buttonClass({ variant: "secondary" })}
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
                  className={buttonClass({ variant: "secondary" })}
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
