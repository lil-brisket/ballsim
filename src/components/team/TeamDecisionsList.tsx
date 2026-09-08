import Link from "next/link";
import type { ActionCenterItem } from "@/state/action-center-selectors";
import { EmptyState } from "@/components/owner/EmptyState";
import { Section } from "@/components/owner/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn, focusRingClass } from "@/components/ui/styles";

/**
 * Compact team-relevant decisions for Team Hub.
 * Not a second Action Center — simple action rows only.
 */
export function TeamDecisionsList(props: {
  items: ActionCenterItem[];
  saveId: string;
}) {
  return (
    <Section
      title="Team Decisions"
      action={
        <Link
          href={`/dashboard/${props.saveId}`}
          className="text-sm text-amber-400 hover:text-amber-300"
        >
          Front Office
        </Link>
      }
    >
      {props.items.length === 0 ? (
        <EmptyState message="No team decisions need attention right now." />
      ) : (
        <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
          {props.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-zinc-100">
                    {item.title}
                  </p>
                  <StatusBadge label={item.severity} tone={item.severity} />
                </div>
                <p className="mt-0.5 truncate text-xs text-zinc-500">
                  {item.description}
                </p>
              </div>
              <Link
                href={item.href}
                className={cn(
                  "shrink-0 rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200 hover:border-amber-600",
                  focusRingClass,
                )}
              >
                {item.hrefLabel}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
