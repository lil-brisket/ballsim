import { formatGameDate } from "@/presentation/game-date";
import { buttonClass } from "@/components/ui/Button";
import Link from "next/link";
import type { ActionCenterItem } from "@/state/action-center-selectors";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  cn,
  focusRingClass,
  linkClass,
  touchTargetTextClass,
} from "@/components/ui/styles";
import { calendarDaysBetween } from "@/domain/calendar-date";

/**
 * Domain-specific decision panel for management hubs.
 * Not a second Action Center — filters existing items only.
 * Shows deadline (WHEN) only when ActionCenterItem.deadline exists.
 */
export function ManagementDecisionPanel(props: {
  title: string;
  items: ActionCenterItem[];
  saveId: string;
  /** Current calendar date for "Due in N days" — never fabricate deadlines. */
  currentDate?: string;
  emptyMessage?: string;
}) {
  const {
    title,
    items,
    saveId,
    currentDate,
    emptyMessage = "No decisions need attention right now.",
  } = props;

  return (
    <Section
      title={title}
      action={
        <Link
          href={`/dashboard/${saveId}`}
          className={cn(linkClass, touchTargetTextClass, focusRingClass)}
        >
          Front Office
        </Link>
      }
    >
      {items.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {items.map((item) => (
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
                {item.entity ? (
                  <p className="mt-0.5 text-sm text-muted">
                    {item.entity.label}
                  </p>
                ) : null}
                {item.deadline && currentDate ? (
                  <p className="mt-0.5 text-sm text-warning/90">
                    {formatDeadlineLabel(currentDate, item.deadline)}
                  </p>
                ) : item.deadline ? (
                  <p className="mt-0.5 text-sm text-warning/90">
                    Due {formatGameDate(item.deadline)}
                  </p>
                ) : null}
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

function formatDeadlineLabel(currentDate: string, deadline: string): string {
  const days = calendarDaysBetween(currentDate, deadline);
  if (days < 0) return `Overdue (${formatGameDate(deadline)})`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due in 1 day";
  return `Due in ${days} days`;
}
