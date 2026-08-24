import {
  acknowledgeNarrativeSituationAction,
  resolveNarrativeSituationAction,
} from "@/application/actions";
import type { OwnerDashboardSituationView } from "@/state/owner-dashboard";
import { StatusBadge } from "@/components/owner/StatusBadge";

export function FranchiseSituations(props: {
  saveId: string;
  situations: OwnerDashboardSituationView[];
  returnPath: string;
}) {
  if (props.situations.length === 0) {
    return null;
  }

  return (
    <section
      className="space-y-3"
      aria-label="Franchise situations"
    >
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-sky-500">
          Franchise situations
        </p>
        <h2 className="mt-1 text-lg font-medium text-zinc-50">
          Active developments
        </h2>
      </div>
      <ul className="space-y-3">
        {props.situations.map((situation) => (
          <li
            key={situation.id}
            className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={situation.severity}
                tone={
                  situation.severity === "critical"
                    ? "critical"
                    : situation.severity === "important"
                      ? "warning"
                      : "info"
                }
              />
              <span className="text-xs uppercase tracking-wide text-zinc-500">
                {situation.category} · {situation.status}
              </span>
            </div>
            <h3 className="mt-2 text-base font-medium text-zinc-100">
              {situation.title}
            </h3>
            <p className="mt-1 text-sm text-zinc-300">{situation.summary}</p>
            <p className="mt-2 text-sm text-zinc-400">{situation.body}</p>
            <ul className="mt-2 space-y-0.5 font-mono text-xs text-zinc-500">
              {Object.entries(situation.evidence)
                .slice(0, 5)
                .map(([key, value]) => (
                  <li key={key}>
                    {key}: {String(value)}
                  </li>
                ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              {situation.actions.map((action) => (
                <form
                  key={action.id}
                  action={resolveNarrativeSituationAction}
                >
                  <input type="hidden" name="saveId" value={props.saveId} />
                  <input
                    type="hidden"
                    name="situationId"
                    value={situation.id}
                  />
                  <input type="hidden" name="actionId" value={action.id} />
                  <input
                    type="hidden"
                    name="returnPath"
                    value={props.returnPath}
                  />
                  <button
                    type="submit"
                    className="rounded-md border border-amber-700/60 bg-amber-950/40 px-3 py-1.5 text-xs text-amber-200 hover:border-amber-500"
                  >
                    {action.label}
                  </button>
                </form>
              ))}
              <form action={acknowledgeNarrativeSituationAction}>
                <input type="hidden" name="saveId" value={props.saveId} />
                <input
                  type="hidden"
                  name="situationId"
                  value={situation.id}
                />
                <input
                  type="hidden"
                  name="returnPath"
                  value={props.returnPath}
                />
                <button
                  type="submit"
                  className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
                >
                  Acknowledge
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
