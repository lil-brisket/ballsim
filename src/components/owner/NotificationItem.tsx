import Link from "next/link";
import { NavIcon } from "@/components/game/NavGroups";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { cn, focusRingClass } from "@/components/ui/styles";
import { formatGameDate } from "@/presentation/game-date";

/** Icon per notification kind (reuses the sidebar icon set). */
export function notificationIconName(type: string | undefined): string {
  switch (type) {
    case "significant_financial_change":
    case "cash_runway_warning":
    case "financial_health_changed":
      return "finances";
    case "playoff_qualified":
    case "playoff_eliminated":
      return "playoffs";
    case "winning_streak":
    case "losing_streak":
      return "standings";
    case "season_completed":
    case "offseason_began":
    case "calendar_milestone":
    case "midseason_event":
      return "calendar";
    case "home_sellout":
    case "poor_attendance":
    case "awareness_band":
      return "media";
    case "objective_completed":
    case "objective_failed":
      return "awards";
    default:
      return "franchise";
  }
}

const SEVERITY_ICON_TONE: Record<string, string> = {
  critical: "border-loss/50 bg-loss/10 text-loss",
  warning: "border-warning/50 bg-warning/10 text-warning",
  success: "border-win/50 bg-win/10 text-win",
};

/** Event row: team badge, kind icon, title, message and a short date. */
export function NotificationItem(props: {
  id: string;
  title: string;
  message: string;
  occurredOn: string;
  severity: string;
  read: boolean;
  type?: string;
  href?: string;
  teamName?: string;
  branding?: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    logoId: string;
  } | null;
}) {
  const body = (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-l-4 px-3 py-3",
        props.read
          ? "border-zinc-800 border-l-zinc-700 bg-zinc-900/40"
          : "border-team-ink/50 border-l-team-ink bg-team/20",
      )}
    >
      {props.branding && props.teamName ? (
        <TeamBadge
          branding={props.branding}
          name={props.teamName}
          size="md"
          className="mt-0.5"
        />
      ) : null}
      <span
        aria-hidden
        className={cn(
          "mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border",
          SEVERITY_ICON_TONE[props.severity] ??
            "border-zinc-700 bg-zinc-900 text-zinc-300",
        )}
      >
        <NavIcon name={notificationIconName(props.type)} className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-zinc-100">{props.title}</p>
          <span className="shrink-0 text-sm tabular-nums text-zinc-400">
            {formatGameDate(props.occurredOn)}
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-400">{props.message}</p>
        <div className="mt-2">
          <StatusBadge label={props.severity} tone={props.severity} />
        </div>
      </div>
    </div>
  );

  if (props.href) {
    return (
      <Link
        href={props.href}
        className={cn("block rounded-lg hover:opacity-90", focusRingClass)}
      >
        {body}
      </Link>
    );
  }
  return body;
}
