import Link from "next/link";
import { notFound } from "next/navigation";
import { prismaSaveGameStore } from "@/persistence/save-game-repository";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Metric } from "@/components/ui/Metric";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { toPlayoffHubView } from "@/state/playoff-hub-selectors";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

const STATUS_LABEL: Record<string, string> = {
  not_in_playoffs: "Not in playoffs",
  in_playoffs: "In playoffs",
  eliminated: "Eliminated",
  advanced: "Advanced",
  champion: "Champion",
};

export default async function PlayoffsPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const loaded = await prismaSaveGameStore.load(saveId);
  if (!loaded) {
    notFound();
  }

  const hub = toPlayoffHubView(loaded.state);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Playoffs"
        subtitle={`Season ${hub.seasonYear}`}
        actions={
          <Link
            href={`/dashboard/${saveId}/standings`}
            className="text-sm text-amber-400 hover:underline"
          >
            Standings
          </Link>
        }
      />
      {error ? <ErrorState message={error} /> : null}

      {!hub.available ? (
        <EmptyState message="No playoff bracket is available yet. Use the Calendar to advance into the postseason." />
      ) : (
        <>
          <div
            className="flex flex-wrap gap-x-6 gap-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3"
            aria-label="Playoff summary"
          >
            <Metric
              label="Status"
              value={hub.tournamentStatus.replaceAll("_", " ")}
              density="compact"
            />
            <Metric
              label="Round"
              value={hub.currentRoundLabel ?? "—"}
              density="compact"
            />
            <Metric label="Your team" value={hub.userTeamName} density="compact" />
            <Metric
              label="Your status"
              value={STATUS_LABEL[hub.userStatus] ?? hub.userStatus}
              density="compact"
            />
            {hub.championTeamName ? (
              <Metric
                label="Champion"
                value={hub.championTeamName}
                density="compact"
              />
            ) : null}
          </div>

          {/* Desktop / tablet: columns; mobile: stacked rounds */}
          <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-4">
            {hub.rounds.map((round) => (
              <Section key={round.round} title={round.label}>
                <ul className="space-y-2">
                  {round.series.map((series) => (
                    <SeriesCard
                      key={series.id}
                      saveId={saveId}
                      series={series}
                    />
                  ))}
                </ul>
              </Section>
            ))}
          </div>

          <div className="space-y-4 md:hidden">
            {hub.rounds.map((round) => (
              <Section key={round.round} title={round.label}>
                <ul className="space-y-2">
                  {round.series.map((series) => (
                    <SeriesCard
                      key={series.id}
                      saveId={saveId}
                      series={series}
                    />
                  ))}
                </ul>
              </Section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SeriesCard(props: {
  saveId: string;
  series: {
    id: string;
    status: string;
    higherSeed: number | null;
    lowerSeed: number | null;
    higherSeedTeamId: string | null;
    lowerSeedTeamId: string | null;
    higherSeedTeamName: string | null;
    lowerSeedTeamName: string | null;
    higherWins: number;
    lowerWins: number;
  };
}) {
  const { series, saveId } = props;
  return (
    <li className="rounded-lg border border-zinc-800 px-3 py-2 text-sm">
      <div className="mb-1 flex justify-end">
        <StatusBadge label={series.status} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-zinc-200">
          {series.higherSeed != null ? `#${series.higherSeed} ` : ""}
          {series.higherSeedTeamId && series.higherSeedTeamName ? (
            <TeamEntityLink
              saveId={saveId}
              teamId={series.higherSeedTeamId}
            >
              {series.higherSeedTeamName}
            </TeamEntityLink>
          ) : (
            <span className="text-zinc-600">TBD</span>
          )}
        </span>
        <span className="font-mono text-zinc-100">{series.higherWins}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-zinc-200">
          {series.lowerSeed != null ? `#${series.lowerSeed} ` : ""}
          {series.lowerSeedTeamId && series.lowerSeedTeamName ? (
            <TeamEntityLink saveId={saveId} teamId={series.lowerSeedTeamId}>
              {series.lowerSeedTeamName}
            </TeamEntityLink>
          ) : (
            <span className="text-zinc-600">TBD</span>
          )}
        </span>
        <span className="font-mono text-zinc-100">{series.lowerWins}</span>
      </div>
    </li>
  );
}
