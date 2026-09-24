import Link from "next/link";
import type { FreeAgentView } from "@/state/selectors";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { DataTable } from "@/components/owner/DataTable";
import { EmptyState } from "@/components/owner/EmptyState";

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
        <p className="text-sm text-zinc-400">
          Roster shortcut — open Free Agency to sign or make offers.
        </p>
        <Link
          href={props.freeAgencyHubHref}
          className="text-sm text-amber-400 hover:text-amber-300"
        >
          Full Free Agency →
        </Link>
      </div>
      <div className="overflow-x-auto">
        <DataTable headers={["Player", "Pos", "OVR", "Age", "Action"]}>
          {props.freeAgents.slice(0, 40).map((agent) => (
            <tr key={agent.playerId} className="border-t border-zinc-800">
              <td className="px-3 py-2">
                <PlayerEntityLink
                  saveId={props.saveId}
                  playerId={agent.playerId}
                >
                  {agent.firstName} {agent.lastName}
                </PlayerEntityLink>
              </td>
              <td className="px-3 py-2 text-zinc-400">{agent.position}</td>
              <td className="px-3 py-2 text-zinc-200">{agent.overall}</td>
              <td className="px-3 py-2 text-zinc-400">{agent.age}</td>
              <td className="px-3 py-2">
                <Link
                  href={props.freeAgencyHubHref}
                  className="text-xs text-amber-400 hover:text-amber-300"
                >
                  View in Free Agency →
                </Link>
              </td>
            </tr>
          ))}
        </DataTable>
      </div>
      {props.freeAgents.length > 40 ? (
        <p className="text-xs text-zinc-600">
          Showing top 40 by overall.{" "}
          <Link
            href={props.freeAgencyHubHref}
            className="text-amber-400 hover:text-amber-300"
          >
            See all
          </Link>
        </p>
      ) : null}
    </div>
  );
}
