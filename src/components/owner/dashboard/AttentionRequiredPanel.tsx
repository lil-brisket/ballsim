import { buttonClass } from "@/components/ui/Button";
import Link from "next/link";
import { cn, focusRingClass } from "@/components/ui/styles";
import type { OwnerDashboardActionItem } from "@/state/owner-dashboard";
import type { PhaseResponsibility } from "@/systems/simulation/phase-responsibility";
import { SectionHeading } from "@/components/ui/SectionHeading";
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
        <SectionHeading title="You're in good shape" />
        <p className="mt-1 text-sm text-muted">
          No urgent franchise decisions require your attention right now.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3" aria-label="Attention required">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeading
          eyebrow="Attention required"
          title={
            criticalCount > 0
              ? `${criticalCount} action${criticalCount === 1 ? "" : "s"} require attention`
              : "Action queue"
          }
        />
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
              className="rounded-lg border border-line-strong bg-surface-raised/50 px-3 py-2 text-sm text-soft"
            >
              <span className="font-medium text-ink">{item.title}</span>
              <span className="text-faint"> — {item.detail}</span>
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
              <SectionHeading as="h3" size="sm" title={item.title} />
              <StatusBadge label={item.severity} tone={item.severity} />
            </div>
            <p className="mt-2 text-sm text-soft">{item.what}</p>
            <p className="mt-2 text-sm text-muted">
              <span className="font-medium text-soft">Why it matters: </span>
              {item.why}
            </p>
            {item.evidence.length > 0 ? (
              <ul className="mt-2 space-y-0.5 text-sm text-faint">
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
