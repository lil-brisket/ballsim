import { buttonClass } from "@/components/ui/Button";
import Link from "next/link";
import type { ActionCenterView } from "@/state/action-center-selectors";
import { ActionCard } from "@/components/ui/ActionCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ArenaPanel } from "@/components/ui/ArenaPanel";
import { cn, touchTargetTextClass } from "@/components/ui/styles";

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
        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-win/30 bg-win/10 px-4 py-3"
        aria-label="Action center"
      >
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-win">
          Action Center
        </p>
        <h2 className="font-display text-lg font-bold uppercase tracking-wide text-zinc-50">
          You&apos;re in good shape
        </h2>
        <p className="text-sm text-zinc-300">
          No urgent franchise decisions require your attention right now.
        </p>
      </section>
    );
  }

  return (
    <ArenaPanel
      edge="left"
      glow={isActionsFocal}
      density={isActionsFocal ? "comfortable" : "compact"}
      className="space-y-3"
      aria-labelledby="action-center-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            aria-hidden
            className="inline-flex h-2.5 w-2.5 rounded-full bg-live team-pulse"
          />
          <h2
            id="action-center-title"
            className={cn(
              "font-display font-bold uppercase tracking-wide text-zinc-50",
              isActionsFocal ? "text-2xl" : "text-xl",
            )}
          >
            {view.urgentCount > 0
              ? `${view.urgentCount} action${view.urgentCount === 1 ? "" : "s"} need attention`
              : "Action queue"}
          </h2>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-400">
            Action Center
          </p>
        </div>
        {props.aiCanHandle && props.letAiHandleAction ? (
          <form action={props.letAiHandleAction}>
            <input type="hidden" name="saveId" value={props.saveId} />
            <input type="hidden" name="returnPath" value={props.returnPath} />
            <button
              type="submit"
              className={buttonClass({ variant: "secondary" })}
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
                  ? "border-loss/50 bg-loss/10"
                  : item.severity === "warning"
                    ? "border-warning/40 bg-warning/10"
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
                <span className="text-xs font-medium text-team-ink">
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
        <p className="text-xs text-zinc-400">
          Next Game is your primary focus while the queue is quiet.{" "}
          <Link
            href={`/dashboard/${props.saveId}/calendar`}
            className={cn(
              touchTargetTextClass,
              "text-team-ink hover:underline",
            )}
          >
            Open Calendar
          </Link>
        </p>
      ) : null}
    </ArenaPanel>
  );
}
