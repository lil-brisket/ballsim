"use client";

import {
  MomentReplayButton,
  momentKey,
  useMomentGate,
} from "@/components/moments";
import {
  AwardsBody,
  FinancesBody,
  GamesBody,
  PlayerBody,
  RecordBody,
  SeasonRecap,
  TrajectoryBody,
  recordLine,
} from "@/components/moments/SeasonRecap";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { SeasonRecapView } from "@/state/season-recap-selectors";

function Fact(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <SectionHeading as="h3" size="sm" tone="muted" title={props.title} />
      {props.children}
    </div>
  );
}

/**
 * The season recap's facts on a normal page, with a replay button. The gate
 * is replay-only: the dashboard host owns auto-opening.
 */
export function SeasonRecapPanel(props: {
  saveId: string;
  view: SeasonRecapView;
}) {
  const { view } = props;
  const gate = useMomentGate(
    props.saveId,
    momentKey("recap", view.teamId, view.seasonYear),
    { eligible: false },
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold tabular-nums text-ink">
            {recordLine(view)}
          </p>
          <p className="text-sm text-muted">{view.teamName}</p>
        </div>
        <MomentReplayButton
          onReplay={gate.replay}
          label={`Replay ${view.seasonYear} recap`}
        />
      </div>
      <Fact title="Finish">
        <RecordBody view={view} />
      </Fact>
      {view.bestGames.length > 0 ? (
        <Fact title="Best games">
          <GamesBody view={view} />
        </Fact>
      ) : null}
      {view.awardWinners.length > 0 ? (
        <Fact title="Your award winners">
          <AwardsBody view={view} />
        </Fact>
      ) : null}
      {view.bestPlayer ? (
        <Fact title="Best player">
          <p className="text-lg font-medium text-ink">{view.bestPlayer.name}</p>
          <PlayerBody player={view.bestPlayer} />
        </Fact>
      ) : null}
      <Fact title="The books">
        <FinancesBody view={view} />
      </Fact>
      <Fact title="Where the franchise is heading">
        <TrajectoryBody view={view} />
      </Fact>
      <SeasonRecap view={view} open={gate.open} onClose={gate.close} />
    </div>
  );
}
