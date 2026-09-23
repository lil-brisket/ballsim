import { notFound } from "next/navigation";
import { prismaSaveGameStore } from "@/persistence/save-game-repository";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { EmptyState } from "@/components/owner/EmptyState";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { toAllStarHubView } from "@/state/all-star-hub-selectors";

type PageProps = {
  params: Promise<{ saveId: string }>;
};

export default async function AllStarPage({ params }: PageProps) {
  const { saveId } = await params;
  const loaded = await prismaSaveGameStore.load(saveId);
  if (!loaded) notFound();

  const hub = toAllStarHubView(loaded.state);
  const starters = hub.selections.filter((s) => s.role === "starter");
  const reserves = hub.selections.filter((s) => s.role === "reserve");

  return (
    <div className="space-y-4">
      <PageHeader
        title="All-Star"
        subtitle={
          hub.eventDate
            ? `Event date ${hub.eventDate} · ${hub.status}`
            : "All-Star event not scheduled"
        }
      />

      {hub.selections.length === 0 ? (
        <EmptyState
          title="Selections pending"
          message="All-Star selections are announced after fan voting closes."
        />
      ) : (
        <>
          <Section title="Starters">
            <SelectionList saveId={saveId} rows={starters} />
          </Section>
          <Section title="Reserves">
            <SelectionList saveId={saveId} rows={reserves} />
          </Section>
        </>
      )}
    </div>
  );
}

function SelectionList(props: {
  saveId: string;
  rows: ReturnType<typeof toAllStarHubView>["selections"];
}) {
  if (props.rows.length === 0) {
    return <p className="text-sm text-zinc-500">None yet.</p>;
  }
  return (
    <ul className="divide-y divide-zinc-800">
      {props.rows.map((row) => (
        <li key={row.playerId} className="flex justify-between gap-3 py-2 text-sm">
          <div>
            <PlayerEntityLink saveId={props.saveId} playerId={row.playerId}>
              {row.playerName}
            </PlayerEntityLink>
            {row.teamId && row.teamName ? (
              <div className="text-xs text-zinc-500">
                <TeamEntityLink saveId={props.saveId} teamId={row.teamId}>
                  {row.teamName}
                </TeamEntityLink>
              </div>
            ) : null}
          </div>
          <span className="text-zinc-400">
            {row.voteRank != null ? `Vote #${row.voteRank}` : row.role}
          </span>
        </li>
      ))}
    </ul>
  );
}
