import { buttonClass } from "@/components/ui/Button";
import {
  acknowledgeNarrativeSituationAction,
  resolveNarrativeSituationAction,
} from "@/application/actions";
import type { OwnerDashboardSituationView } from "@/state/owner-dashboard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/components/ui/styles";

export function FranchiseSituations(props: {
  saveId: string;
  situations: OwnerDashboardSituationView[];
  returnPath: string;
}) {
  if (props.situations.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3" aria-label="Franchise situations">
      <SectionHeading title="Active developments" />
      <ul className="space-y-3">
        {props.situations.map((situation) => (
          <li
            key={situation.id}
            className="rounded-xl border border-line bg-surface-base/60 px-4 py-3"
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
              <span className="text-sm text-faint">
                {situation.category} · {situation.status}
              </span>
            </div>
            <SectionHeading
              as="h3"
              size="sm"
              className="mt-2"
              title={situation.title}
            />
            <p className="mt-1 text-sm text-soft">{situation.summary}</p>
            <p className="mt-2 text-sm text-muted">{situation.body}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {situation.actions.map((action) => (
                <form
                  key={action.id}
                  action={resolveNarrativeSituationAction}
                  className="max-w-xs"
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
                    className={cn(
                      buttonClass({ variant: "secondary" }),
                      "w-full sm:w-auto",
                    )}
                  >
                    {action.label}
                  </button>
                  {action.effectSummary ? (
                    <p className="mt-1 text-sm leading-snug text-faint">
                      {action.effectSummary}
                    </p>
                  ) : null}
                </form>
              ))}
              <form action={acknowledgeNarrativeSituationAction}>
                <input type="hidden" name="saveId" value={props.saveId} />
                <input type="hidden" name="situationId" value={situation.id} />
                <input
                  type="hidden"
                  name="returnPath"
                  value={props.returnPath}
                />
                <button
                  type="submit"
                  className={cn(
                    buttonClass({ variant: "quiet" }),
                    "w-full sm:w-auto",
                  )}
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
