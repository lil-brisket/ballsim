import Link from "next/link";
import type {
  OwnerDashboardMediaHeadline,
  OwnerDashboardNextEvent,
  OwnerDashboardTeam,
} from "@/state/owner-dashboard";
import { EmptyState } from "@/components/owner/EmptyState";
import { EventCard } from "@/components/game/EventCard";
import { Section } from "@/components/owner/Section";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";

function HubCtaLink(props: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={props.href}
      className="block rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4 transition-colors hover:border-amber-700/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
    >
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-amber-500">
        {props.title}
      </p>
      <p className="mt-1 text-sm text-zinc-300">{props.description}</p>
    </Link>
  );
}

export function DashboardHubLinks(props: { saveId: string }) {
  const base = `/dashboard/${props.saveId}`;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <HubCtaLink
        href={`${base}/calendar`}
        title="Calendar"
        description="Primary time control — review today, upcoming events, and advance with intent."
      />
      <HubCtaLink
        href={`${base}/media`}
        title="Media Hub"
        description="League news, franchise attention, and the transaction wire."
      />
    </div>
  );
}

export function NextGamePanel(props: {
  team: OwnerDashboardTeam;
  saveId: string;
}) {
  const nextGame = props.team.upcomingGames[0];
  const scheduleHref = `/dashboard/${props.saveId}/schedule`;
  const calendarHref = `/dashboard/${props.saveId}/calendar`;

  return (
    <Section
      title="Next Game"
      action={
        <Link
          href={scheduleHref}
          className="text-sm text-amber-400 hover:text-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          Schedule
        </Link>
      }
    >
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4">
        {!nextGame ? (
          <EmptyState message="No upcoming scheduled games." />
        ) : (
          <div className="space-y-3">
            <p className="font-mono text-xs text-zinc-500">{nextGame.date}</p>
            <p className="inline-flex items-center gap-2 text-lg text-zinc-50">
              <span>{nextGame.home ? "vs" : "@"}</span>
              {nextGame.opponentBranding ? (
                <span
                  className="inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded border border-zinc-700"
                  style={{
                    backgroundColor: nextGame.opponentBranding.primaryColor,
                  }}
                >
                  <TeamLogoMark
                    branding={nextGame.opponentBranding}
                    size="sm"
                    decorative
                  />
                </span>
              ) : null}
              <span>
                {nextGame.opponentName} ({nextGame.opponentAbbreviation})
              </span>
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link
                href={
                  nextGame.gameId
                    ? `/dashboard/${props.saveId}/games/${nextGame.gameId}`
                    : scheduleHref
                }
                className="text-amber-400 hover:text-amber-300"
              >
                Game details
              </Link>
              <Link
                href={calendarHref}
                className="text-zinc-400 hover:text-zinc-200"
              >
                Open Calendar
              </Link>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

export function NextImportantEventPanel(props: {
  event: OwnerDashboardNextEvent | null;
  saveId: string;
}) {
  const calendarHref = `/dashboard/${props.saveId}/calendar`;
  const event = props.event;

  return (
    <Section
      title="Next Important Event"
      action={
        <Link
          href={calendarHref}
          className="text-sm text-amber-400 hover:text-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          Calendar
        </Link>
      }
    >
      {!event ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4">
          <EmptyState message="No high-importance events on the horizon." />
        </div>
      ) : (
        <ul className="space-y-2">
          <EventCard
            title={event.title}
            description={
              event.description ??
              (event.daysUntil === 0
                ? "Today"
                : `${event.daysUntil} day${event.daysUntil === 1 ? "" : "s"} away`)
            }
            date={event.date}
            type={event.category}
            severity={event.blocking ? "warning" : undefined}
          />
          <li className="list-none px-1">
            <Link
              href={event.href ?? calendarHref}
              className="text-sm text-amber-400 hover:text-amber-300"
            >
              {event.href ? "Open event" : "Open Calendar"}
            </Link>
          </li>
        </ul>
      )}
    </Section>
  );
}

export function LeagueNewsPanel(props: {
  headlines: OwnerDashboardMediaHeadline[];
  saveId: string;
}) {
  const mediaHref = `/dashboard/${props.saveId}/media`;

  return (
    <Section
      title="League News"
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
          <EmptyState message="No media stories yet. Advance the season to fill the feed." />
        </div>
      ) : (
        <ul className="space-y-2">
          {props.headlines.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="block rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 transition-colors hover:border-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-zinc-100">{item.headline}</p>
                  {item.unread ? (
                    <span className="font-mono text-[0.65rem] uppercase tracking-wide text-amber-400">
                      New
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
                  {item.summary}
                </p>
                <p className="mt-1 font-mono text-xs text-zinc-600">
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
