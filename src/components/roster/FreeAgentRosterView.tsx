import {
  cn,
  focusRingClass,
  linkClass,
  touchTargetTextClass,
} from "@/components/ui/styles";
import Link from "next/link";
import type { FreeAgentView } from "@/state/selectors";
import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { OvrBadge } from "@/components/ui/OvrBadge";

export function FreeAgentRosterView(props: {
  saveId: string;
  freeAgents: FreeAgentView[];
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
      <DataTable headers={["Player", "Pos", "OVR", "Age", "Action"]}>
        {props.freeAgents.slice(0, 40).map((agent) => (
          <tr key={agent.playerId}>
            <td className="px-3 py-2">
              <span className="flex items-center gap-2">
                <PlayerPortrait
                  playerId={agent.playerId}
                  portrait={agent.portrait}
                  firstName={agent.firstName}
                  lastName={agent.lastName}
                  size="sm"
                />
                <PlayerEntityLink
                  saveId={props.saveId}
                  playerId={agent.playerId}
                >
                  {agent.firstName} {agent.lastName}
                </PlayerEntityLink>
              </span>
            </td>
            <td className="px-3 py-2 text-muted">{agent.position}</td>
            <td className="px-3 py-2">
              <OvrBadge
                overall={agent.overall}
                size="sm"
                className="align-middle"
              />
            </td>
            <td className="px-3 py-2 text-muted">{agent.age}</td>
            <td className="px-3 py-2">
              <Link
                href={props.freeAgencyHubHref}
                className={cn(linkClass, touchTargetTextClass, focusRingClass)}
              >
                View in Free Agency →
              </Link>
            </td>
          </tr>
        ))}
      </DataTable>

      {props.freeAgents.length > 40 ? (
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
