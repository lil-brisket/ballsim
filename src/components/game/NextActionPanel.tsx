import Link from "next/link";
import { formatGameDate } from "@/presentation/game-date";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn, focusRingClass } from "@/components/ui/styles";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import type { DashboardSnapshot } from "@/state/selectors";
import type { TeamBrandingView } from "@/state/team-branding-view";

export type NextActionPresentation = {
  title: string;
  description: string;
  href?: string;
  hrefLabel?: string;
  opponentBranding?: TeamBrandingView | null;
};

/**
 * Presentation-only prioritization from already-exposed snapshot flags.
 * Must never determine phase, eligibility, outcomes, or state transitions.
 */
export function resolveNextActionPresentation(
  dashboard: DashboardSnapshot,
  saveId: string,
): NextActionPresentation {
  if (dashboard.userOnDraftClock) {
    return {
      title: "Review draft board",
      description:
        "Your team is on the draft clock. Open the Draft screen to make a selection before advancing time.",
      href: `/dashboard/${saveId}/draft`,
      hrefLabel: "Open Draft",
    };
  }

  const importantUnread = dashboard.notifications.some(
    (n) => !n.read && (n.severity === "warning" || n.severity === "critical"),
  );
  if (importantUnread || dashboard.unreadNotificationCount > 0) {
    return {
      title: "You have events to review",
      description: importantUnread
        ? "An important notification needs your attention."
        : `You have ${dashboard.unreadNotificationCount} unread notification${dashboard.unreadNotificationCount === 1 ? "" : "s"}.`,
      href: `/dashboard/${saveId}/notifications`,
      hrefLabel: "Open Notifications",
    };
  }

  const nextGame = dashboard.upcomingGames[0];
  if (nextGame) {
    return {
      title: "Advance time",
      description: `Next game ${nextGame.home ? "vs" : "@"} ${nextGame.opponentAbbreviation} on ${formatGameDate(nextGame.date, { weekday: true })}. Use Advance day or Advance 7 days when ready.`,
      opponentBranding: nextGame.opponentBranding,
    };
  }

  return {
    title: "Advance time",
    description:
      "Use the advance controls to continue the season when you are ready.",
  };
}

export function NextActionPanel(props: { action: NextActionPresentation }) {
  const { action } = props;
  return (
    <section
      className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-4"
      aria-label="Suggested next action"
    >
      <SectionHeading eyebrow="Next" title={action.title} />
      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-soft">
        {action.opponentBranding ? (
          <span
            className="inline-flex shrink-0 items-center justify-center rounded-sm p-0.5"
            style={{
              backgroundColor: action.opponentBranding.primaryColor,
            }}
          >
            <TeamLogoMark
              branding={action.opponentBranding}
              size="sm"
              decorative
            />
          </span>
        ) : null}
        <span>{action.description}</span>
      </p>
      {action.href && action.hrefLabel ? (
        <Link
          href={action.href}
          className={cn(
            "mt-3 inline-flex rounded-md border border-warning/40 px-3 py-1.5 text-sm text-warning hover:bg-warning/20",
            focusRingClass,
          )}
        >
          {action.hrefLabel}
        </Link>
      ) : null}
    </section>
  );
}
