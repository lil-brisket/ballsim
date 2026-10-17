import { buttonClass } from "@/components/ui/Button";
import Link from "next/link";
import { cn, focusRingClass } from "@/components/ui/styles";
import type { OwnerDashboardActionItem } from "@/state/owner-dashboard";
import type { PhaseResponsibility } from "@/systems/simulation/phase-responsibility";
import { StatusBadge } from "@/components/ui/StatusBadge";

/**
 * Attention Required panel — evolves ActionQueue with AI handoff affordance.
 */
export function AttentionRequiredPanel(props: {
  items: OwnerDashboardActionItem[];
  responsibility?: PhaseResponsibility;
  saveId: string;
  returnPath: string;
  aiCanHandle?: boolean;
  letAiHandleAction?: (formData: FormData) => void | Promise<void>;
}) {
  const unresolved = props.responsibility?.unresolvedItems ?? [];
  const criticalCount = props.items.filter(
    (item) => item.severity === "critical" || item.severity === "warning",
  ).length;

  if (props.items.length === 0 && unresolved.length === 0) {
    return (
      <section
        className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 px-4 py-5"
        aria-label="Attention required"
      >
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-emerald-500">
          Attention required
        </p>
        <h2 className="mt-1 text-lg font-medium text-zinc-50">
          You&apos;re in good shape
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          No urgent franchise decisions require your attention right now.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3" aria-label="Attention required">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-warning">
            Attention required
          </p>
          <h2 className="mt-1 text-lg font-medium text-zinc-50">
            {criticalCount > 0
              ? `${criticalCount} action${criticalCount === 1 ? "" : "s"} require attention`
              : "Action queue"}
          </h2>
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

      {props.aiCanHandle ? (
        <p className="text-sm text-emerald-400/90">
          AI can handle these automatically
        </p>
      ) : null}

      {unresolved.length > 0 ? (
        <ul className="space-y-2">
          {unresolved.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-300"
            >
              <span className="font-medium text-zinc-100">{item.title}</span>
              <span className="text-zinc-500"> — {item.detail}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <ul className="space-y-3">
        {props.items.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-medium text-zinc-50">
                {item.title}
              </h3>
              <StatusBadge label={item.severity} tone={item.severity} />
            </div>
            <p className="mt-2 text-sm text-zinc-300">{item.what}</p>
            <p className="mt-2 text-sm text-zinc-400">
              <span className="font-medium text-zinc-300">
                Why it matters:{" "}
              </span>
              {item.why}
            </p>
            {item.evidence.length > 0 ? (
              <ul className="mt-2 space-y-0.5 text-xs text-zinc-500">
                {item.evidence.map((line, index) => (
                  <li key={`${index}-${line}`}>· {line}</li>
                ))}
              </ul>
            ) : null}
            <Link
              href={item.href}
              className={cn(
                "mt-3 inline-flex rounded-md border border-warning/40 px-3 py-1.5 text-sm text-warning hover:bg-warning/20",
                focusRingClass,
              )}
            >
              {item.hrefLabel}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
