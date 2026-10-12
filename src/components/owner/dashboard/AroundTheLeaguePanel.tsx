import Link from "next/link";
import type { OwnerDashboardMediaHeadline } from "@/state/owner-dashboard";
import { EmptyState } from "@/components/owner/EmptyState";
import { Section } from "@/components/owner/Section";
import { ArenaPanel } from "@/components/ui/ArenaPanel";
import {
  cn,
  focusRingClass,
  touchTargetTextClass,
} from "@/components/ui/styles";

/**
 * Around the League — Phase 2 uses existing reliable media headlines only.
 * No standingsDelta backend work.
 */
export function AroundTheLeaguePanel(props: {
  headlines: OwnerDashboardMediaHeadline[];
  saveId: string;
}) {
  const mediaHref = `/dashboard/${props.saveId}/media`;

  return (
    <Section
      title="Around the League"
      action={
        <Link
          href={mediaHref}
          className={cn(
            touchTargetTextClass,
            "text-sm text-team-ink hover:underline",
            focusRingClass,
          )}
        >
          Media Hub
        </Link>
      }
    >
      {props.headlines.length === 0 ? (
        <ArenaPanel as="div" density="default">
          <EmptyState message="No league stories yet. Advance the season to fill the briefing." />
        </ArenaPanel>
      ) : (
        <ArenaPanel as="div" edge="left" density="compact" className="!p-0">
          <ul className="divide-y divide-surface-line">
            {props.headlines.slice(0, 5).map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={cn(
                    "block px-4 py-3 transition-colors hover:bg-white/5",
                    focusRingClass,
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {item.unread ? (
                      <span className="rounded bg-live px-1.5 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-wide text-zinc-950">
                        New
                      </span>
                    ) : null}
                    <p className="font-display text-lg font-bold uppercase leading-tight tracking-wide text-zinc-50">
                      {item.headline}
                    </p>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-zinc-300">
                    {item.summary}
                  </p>
                  <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-wide text-zinc-500">
                    {item.occurredOn} · {item.importance}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </ArenaPanel>
      )}
    </Section>
  );
}
