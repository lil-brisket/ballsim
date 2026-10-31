import {
  cn,
  focusRingClass,
  linkClass,
  touchTargetTextClass,
} from "@/components/ui/styles";
import Link from "next/link";
import type { SheetPlayerView } from "@/state/roster-sheet-view";
import { RosterSheet } from "@/components/roster/sheet/RosterSheet";
import { EmptyState } from "@/components/ui/EmptyState";

export function FreeAgentRosterView(props: {
  saveId: string;
  freeAgents: SheetPlayerView[];
  /** All free agents; more than shown adds the "See all" footnote. */
  freeAgentCount: number;
  freeAgencyHubHref: string;
  freeAgencyActive: boolean;
}) {
  if (props.freeAgents.length === 0) {
    return (
      <EmptyState
        message={
          props.freeAgencyActive
            ? "No free agents available."
            : "Free agency market is empty right now."
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          Roster shortcut — open Free Agency to sign or make offers.
        </p>
        <Link
          href={props.freeAgencyHubHref}
          className={cn(linkClass, touchTargetTextClass, focusRingClass)}
        >
          Full Free Agency →
        </Link>
      </div>
      <RosterSheet
        variant="market"
        label="Free agent sheet"
        saveId={props.saveId}
        players={props.freeAgents}
        returnPath={`/dashboard/${props.saveId}/roster?tab=free-agents`}
        marketHref={props.freeAgencyHubHref}
      />

      {props.freeAgentCount > props.freeAgents.length ? (
        <p className="text-sm text-disabled">
          Showing top 40 by overall.{" "}
          <Link
            href={props.freeAgencyHubHref}
            className={cn(linkClass, touchTargetTextClass, focusRingClass)}
          >
            See all
          </Link>
        </p>
      ) : null}
    </div>
  );
}
