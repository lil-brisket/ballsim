import Link from "next/link";
import type { OwnerDashboardActionItem } from "@/state/owner-dashboard";
import { StatusBadge } from "@/components/owner/StatusBadge";

export function ActionQueue(props: {
  items: OwnerDashboardActionItem[];
}) {
  if (props.items.length === 0) {
    return (
      <section
        className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 px-4 py-5"
        aria-label="What needs your attention"
      >
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-emerald-500">
          What needs your attention
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
    <section
      className="space-y-3"
      aria-label="What needs your attention"
    >
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
          What needs your attention
        </p>
        <h2 className="mt-1 text-lg font-medium text-zinc-50">Action queue</h2>
      </div>
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
                {item.evidence.map((line) => (
                  <li key={line}>· {line}</li>
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
