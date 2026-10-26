import { buttonClass } from "@/components/ui/Button";
import Link from "next/link";
import type { ActionCenterItem } from "@/state/action-center-selectors";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/components/ui/styles";

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
          className="text-sm text-team-ink underline-offset-4 hover:underline"
        >
          Front Office
        </Link>
      }
    >
      {props.items.length === 0 ? (
        <EmptyState message="No team decisions need attention right now." />
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {props.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-ink">{item.title}</p>
                  <StatusBadge label={item.severity} tone={item.severity} />
                </div>
                <p className="mt-0.5 truncate text-sm text-faint">
                  {item.description}
                </p>
              </div>
              <Link
                href={item.href}
                className={cn(
                  buttonClass({ variant: "secondary" }),
                  "shrink-0",
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
