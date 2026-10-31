import Link from "next/link";
import { cn, focusRingClass } from "@/components/ui/styles";
import type { OwnerDashboardActionItem } from "@/state/owner-dashboard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StatusBadge } from "@/components/ui/StatusBadge";

export function ActionQueue(props: { items: OwnerDashboardActionItem[] }) {
  if (props.items.length === 0) {
    return (
      <section
        className="rounded-xl border border-success/40 bg-success-soft px-4 py-5"
        aria-label="What needs your attention"
      >
        <SectionHeading title="You're in good shape" />
        <p className="mt-1 text-sm text-muted">
          No urgent franchise decisions require your attention right now.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3" aria-label="What needs your attention">
      <SectionHeading
        eyebrow="What needs your attention"
        title="Action queue"
      />
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
