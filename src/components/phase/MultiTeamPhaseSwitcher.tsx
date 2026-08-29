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
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">
        Your franchises
      </p>
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
                <input type="hidden" name="returnPath" value={props.returnPath} />
                <input type="hidden" name="teamId" value={team.teamId} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900/50 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500"
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
    return <span className="text-xs text-zinc-500">✓</span>;
  }
  return (
    <span className="text-xs text-zinc-400">
      {requiredCount > 0 ? (
        <span className="text-red-400">{requiredCount} req</span>
      ) : null}
      {requiredCount > 0 && recommendedCount > 0 ? " · " : null}
      {recommendedCount > 0 ? (
        <span className="text-amber-400">{recommendedCount} rec</span>
      ) : null}
    </span>
  );
}
