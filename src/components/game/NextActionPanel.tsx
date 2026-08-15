import Link from "next/link";
import type { DashboardSnapshot } from "@/state/selectors";

export type NextActionPresentation = {
  title: string;
  description: string;
  href?: string;
  hrefLabel?: string;
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
    (n) =>
      !n.read && (n.severity === "warning" || n.severity === "critical"),
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
      description: `Next game ${nextGame.home ? "vs" : "@"} ${nextGame.opponentAbbreviation} on ${nextGame.date}. Use Advance day or Advance 7 days when ready.`,
    };
  }

  return {
    title: "Advance time",
    description:
      "Use the advance controls to continue the season when you are ready.",
  };
}

export function NextActionPanel(props: {
  action: NextActionPresentation;
}) {
  const { action } = props;
  return (
    <section
      className="rounded-xl border border-amber-700/40 bg-amber-950/30 px-4 py-4"
      aria-label="Suggested next action"
    >
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
        Next
      </p>
      <h2 className="mt-1 text-lg font-medium text-zinc-50">{action.title}</h2>
      <p className="mt-1 text-sm text-zinc-300">{action.description}</p>
      {action.href && action.hrefLabel ? (
        <Link
          href={action.href}
          className="mt-3 inline-flex rounded-md border border-amber-600/60 px-3 py-1.5 text-sm text-amber-300 hover:bg-amber-950/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          {action.hrefLabel}
        </Link>
      ) : null}
    </section>
  );
}
