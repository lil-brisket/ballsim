import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestSaveStore } from "@/application/request-save-store";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  cn,
  focusRingClass,
  linkClass,
  touchTargetTextClass,
} from "@/components/ui/styles";
import { Metric } from "@/components/ui/Metric";
import { BracketTree } from "@/components/playoffs/BracketTree";
import { ChampionReplay } from "@/components/playoffs/ChampionReplay";
import { toChampionMomentView } from "@/state/champion-moment-selectors";
import { layoutBracket } from "@/state/playoff-bracket-layout";
import { toPlayoffHubView } from "@/state/playoff-hub-selectors";

export const metadata: Metadata = { title: "Playoffs" };

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
  const loaded = await getRequestSaveStore().load(saveId);
  if (!loaded) {
    notFound();
  }

  const hub = toPlayoffHubView(loaded.state);
  const champion = hub.championTeamId
    ? toChampionMomentView(loaded.state)
    : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Playoffs"
        subtitle={`Season ${hub.seasonYear}`}
        actions={
          <Link
            href={`/dashboard/${saveId}/league/standings`}
            className={cn(
              linkClass,
              touchTargetTextClass,
              focusRingClass,
              "text-sm",
            )}
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
            className="flex flex-wrap gap-x-6 gap-y-3 rounded-xl border border-line bg-surface-raised/40 px-4 py-3"
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
            <Metric
              label="Your team"
              value={hub.userTeamName}
              density="compact"
            />
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

          {champion ? (
            <div>
              <ChampionReplay
                saveId={saveId}
                teamId={hub.userTeamId}
                view={champion}
              />
            </div>
          ) : null}

          <BracketTree saveId={saveId} hub={hub} layout={layoutBracket(hub)} />
        </>
      )}
    </div>
  );
}
