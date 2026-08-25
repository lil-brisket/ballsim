import Link from "next/link";
import type { OwnerDashboardActionItem } from "@/state/owner-dashboard";
import type { PhaseResponsibility } from "@/systems/simulation/phase-responsibility";
import { StatusBadge } from "@/components/owner/StatusBadge";

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
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
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
              className="rounded-md border border-emerald-700/60 bg-emerald-950/40 px-3 py-1.5 text-sm text-emerald-300 hover:border-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
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
            className="rounded-xl border border-amber-800/40 bg-amber-950/20 px-4 py-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-medium text-zinc-50">
                {item.title}
              </h3>
              <StatusBadge label={item.severity} tone={item.severity} />
            </div>
            <p className="mt-2 text-sm text-zinc-300">{item.what}</p>
            <p className="mt-2 text-sm text-zinc-400">
              <span className="font-medium text-zinc-300">Why it matters: </span>
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
              className="mt-3 inline-flex rounded-md border border-amber-600/60 px-3 py-1.5 text-sm text-amber-300 hover:bg-amber-950/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
            >
              {item.hrefLabel}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
