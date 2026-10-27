import { SectionHeading } from "@/components/ui/SectionHeading";
import { buttonClass } from "@/components/ui/Button";
import type { PhaseTeamAttentionView } from "@/state/phase-dashboard";

export function MultiTeamPhaseSwitcher(props: {
  teams: PhaseTeamAttentionView[];
  saveId: string;
  returnPath: string;
  switchAction: (formData: FormData) => void | Promise<void>;
}) {
  if (props.teams.length <= 1) {
    return null;
  }

  return (
    <section aria-label="Controlled teams" className="space-y-2">
      <SectionHeading title="Your franchises" />
      <ul className="flex flex-wrap gap-2">
        {props.teams.map((team) => (
          <li key={team.teamId}>
            {team.isActive ? (
              <span className="inline-flex items-center gap-2 rounded-md border border-emerald-700/60 bg-emerald-950/40 px-3 py-1.5 text-sm text-emerald-200">
                {team.teamLabel}
                <AttentionCounts team={team} />
              </span>
            ) : (
              <form action={props.switchAction}>
                <input type="hidden" name="saveId" value={props.saveId} />
                <input
                  type="hidden"
                  name="returnPath"
                  value={props.returnPath}
                />
                <input type="hidden" name="teamId" value={team.teamId} />
                <button
                  type="submit"
                  className={buttonClass({ variant: "secondary" })}
                >
                  {team.teamLabel}
                  <AttentionCounts team={team} />
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function AttentionCounts(props: { team: PhaseTeamAttentionView }) {
  const { requiredCount, recommendedCount } = props.team;
  if (requiredCount === 0 && recommendedCount === 0) {
    return <span className="text-sm text-faint">✓</span>;
  }
  return (
    <span className="text-sm text-muted">
      {requiredCount > 0 ? (
        <span className="text-red-400">{requiredCount} req</span>
      ) : null}
      {requiredCount > 0 && recommendedCount > 0 ? " · " : null}
      {recommendedCount > 0 ? (
        <span className="text-warning">{recommendedCount} rec</span>
      ) : null}
    </span>
  );
}
