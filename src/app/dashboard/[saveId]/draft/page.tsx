import { notFound } from "next/navigation";
import { draftProspectAction } from "@/application/actions";
import { loadOwnerSaveView } from "@/application/game-service";
import { DataTable } from "@/components/owner/DataTable";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { StatusBadge } from "@/components/owner/StatusBadge";

type DraftPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function DraftPage({
  params,
  searchParams,
}: DraftPageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  const returnPath = `/dashboard/${saveId}/draft`;
  const board = view.draftBoard;

  return (
    <>
      <PageHeader
        title="Draft"
        subtitle={
          board
            ? `${board.status}${board.onClockOverall !== null ? ` · pick ${board.onClockOverall}` : ""}`
            : "Draft board available during offseason draft stage"
        }
      />
      {error ? <ErrorState message={error} /> : null}

      {!board ? (
        <EmptyState message="Draft is not active. Finish free agency or advance into the draft stage." />
      ) : (
        <>
          {board.userOnClock ? (
            <p className="rounded-md border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
              Your team is on the clock. Select a prospect below.
            </p>
          ) : (
            <p className="text-sm text-zinc-500">
              Waiting for other teams (or advance after AI fills).
            </p>
          )}

          <Section title="Your picks">
            {board.ownedPicks.length === 0 ? (
              <EmptyState message="No owned picks in this draft." />
            ) : (
              <ul className="flex flex-wrap gap-2">
                {board.ownedPicks.map((pick) => (
                  <li
                    key={pick.draftPickId}
                    className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300"
                  >
                    #{pick.overallPick} R{pick.round}{" "}
                    <StatusBadge label={pick.status} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Draft order">
            <DataTable
              headers={["Pick", "Team", "Status", "Selected"]}
            >
              {board.order.map((slot) => (
                <tr
                  key={slot.draftPickId}
                  className={`border-t border-zinc-800 ${
                    slot.isUserPick ? "bg-amber-950/20" : ""
                  }`}
                >
                  <td className="px-3 py-2 font-mono text-zinc-300">
                    #{slot.overallPick}
                  </td>
                  <td className="px-3 py-2 text-zinc-200">
                    {slot.ownerAbbreviation}
                    {slot.isUserPick ? " (you)" : ""}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge label={slot.status} />
                  </td>
                  <td className="px-3 py-2 text-zinc-400">
                    {slot.selectedPlayerId ?? "—"}
                  </td>
                </tr>
              ))}
            </DataTable>
          </Section>

          <Section title="Selections">
            {board.selections.length === 0 ? (
              <EmptyState message="No selections yet." />
            ) : (
              <ul className="space-y-1 text-sm text-zinc-300">
                {board.selections.map((selection) => (
                  <li key={`${selection.overallPick}-${selection.playerId}`}>
                    #{selection.overallPick} {selection.teamAbbreviation}:{" "}
                    {selection.playerName}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Eligible prospects">
            {!board.userOnClock ? (
              <EmptyState message="Prospect selection is available when you are on the clock." />
            ) : board.eligibleProspects.length === 0 ? (
              <EmptyState message="No eligible prospects remain." />
            ) : (
              <DataTable headers={["Player", "Pos", "OVR", "Action"]}>
                {board.eligibleProspects.slice(0, 30).map((prospect) => (
                  <tr
                    key={prospect.playerId}
                    className="border-t border-zinc-800"
                  >
                    <td className="px-3 py-2 text-zinc-100">
                      {prospect.firstName} {prospect.lastName}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {prospect.position}
                    </td>
                    <td className="px-3 py-2 text-zinc-200">
                      {prospect.overall}
                    </td>
                    <td className="px-3 py-2">
                      <form action={draftProspectAction}>
                        <input type="hidden" name="saveId" value={saveId} />
                        <input
                          type="hidden"
                          name="prospectPlayerId"
                          value={prospect.playerId}
                        />
                        <input
                          type="hidden"
                          name="returnPath"
                          value={returnPath}
                        />
                        <button
                          type="submit"
                          className="text-xs text-amber-400 hover:underline"
                        >
                          Draft
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Section>
        </>
      )}
    </>
  );
}
