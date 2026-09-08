import Link from "next/link";
import type { ActionCenterView } from "@/state/action-center-selectors";
import { ActionCard } from "@/components/ui/ActionCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn, panelClass } from "@/components/ui/styles";

/**
 * Front Office Action Center.
 * Focal mode controls visual weight — does not reorder sections.
 * Use TeamDecisionsList on Team Hub instead of this component.
 */
export function ActionCenter(props: {
  view: ActionCenterView;
  saveId: string;
  returnPath: string;
  aiCanHandle?: boolean;
  letAiHandleAction?: (formData: FormData) => void | Promise<void>;
}) {
  const { view } = props;
  const isActionsFocal = view.focalMode === "actions";

  if (view.items.length === 0) {
    return (
      <section
        className={cn(
          panelClass,
          "border-emerald-800/40 bg-emerald-950/20 px-4 py-4",
        )}
        aria-label="Action center"
      >
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-emerald-500">
          Action Center
        </p>
        <h2 className="mt-1 text-base font-medium text-zinc-50">
          You&apos;re in good shape
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          No urgent franchise decisions require your attention right now.
        </p>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "space-y-3",
        isActionsFocal &&
          "rounded-xl border border-amber-800/50 bg-amber-950/15 p-4 sm:p-5",
      )}
      aria-label="Action center"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className={cn(
              "font-mono text-[0.65rem] uppercase tracking-[0.16em]",
              isActionsFocal ? "text-amber-400" : "text-zinc-500",
            )}
          >
            Action Center
          </p>
          <h2
            className={cn(
              "mt-1 font-medium text-zinc-50",
              isActionsFocal ? "text-xl" : "text-base",
            )}
          >
            {view.urgentCount > 0
              ? `${view.urgentCount} action${view.urgentCount === 1 ? "" : "s"} need attention`
              : "Action queue"}
          </h2>
        </div>
        {props.aiCanHandle && props.letAiHandleAction ? (
          <form action={props.letAiHandleAction}>
            <input type="hidden" name="saveId" value={props.saveId} />
            <input type="hidden" name="returnPath" value={props.returnPath} />
            <button
              type="submit"
              className="rounded-md border border-emerald-700/60 bg-emerald-950/40 px-3 py-1.5 text-sm text-emerald-300 hover:border-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
            >
              Let AI Handle
            </button>
          </form>
        ) : null}
      </div>

      <ul
        className={cn(
          "grid gap-3",
          isActionsFocal
            ? "sm:grid-cols-2 xl:grid-cols-3"
            : "sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {view.items.map((item) => (
          <li key={item.id}>
            <ActionCard
              href={item.href}
              title={item.title}
              description={item.description}
              density={isActionsFocal ? "comfortable" : "compact"}
              className={
                item.severity === "critical"
                  ? "border-rose-800/50 bg-rose-950/20"
                  : item.severity === "warning"
                    ? "border-amber-800/40 bg-amber-950/15"
                    : undefined
              }
              badge={
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={item.severity} tone={item.severity} />
                  {item.deadline ? (
                    <span className="font-mono text-[0.65rem] text-zinc-500">
                      Due {item.deadline}
                    </span>
                  ) : null}
                </div>
              }
              footer={
                <span className="text-xs font-medium text-amber-400">
                  {item.hrefLabel} →
                </span>
              }
              secondaryHref={item.secondaryHref}
              secondaryLabel={item.secondaryLabel}
            />
          </li>
        ))}
      </ul>

      {!isActionsFocal ? (
        <p className="text-xs text-zinc-500">
          Next Game is your primary focus while the queue is quiet.{" "}
          <Link
            href={`/dashboard/${props.saveId}/calendar`}
            className="text-amber-400 hover:text-amber-300"
          >
            Open Calendar
          </Link>
        </p>
      ) : null}
    </section>
  );
}
