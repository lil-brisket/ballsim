import Link from "next/link";
import type { OwnerDashboardMediaHeadline } from "@/state/owner-dashboard";
import { EmptyState } from "@/components/owner/EmptyState";
import { Section } from "@/components/owner/Section";

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
          className="text-sm text-amber-400 hover:text-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          Media Hub
        </Link>
      }
    >
      {props.headlines.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4">
          <EmptyState message="No league stories yet. Advance the season to fill the briefing." />
        </div>
      ) : (
        <ul className="space-y-2">
          {props.headlines.slice(0, 5).map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="block rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 transition-colors hover:border-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-zinc-100">
                    {item.headline}
                  </p>
                  {item.unread ? (
                    <span className="font-mono text-[0.65rem] uppercase tracking-wide text-amber-400">
                      New
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-zinc-400">
                  {item.summary}
                </p>
                <p className="mt-1 font-mono text-[0.65rem] text-zinc-600">
                  {item.occurredOn} · {item.importance}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
