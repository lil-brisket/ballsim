"use client";

import {
  MomentReplayButton,
  momentKey,
  useMomentGate,
} from "@/components/moments";
import { ChampionMoment } from "@/components/moments/ChampionMoment";
import type { ChampionMomentView } from "@/state/champion-moment-selectors";

/**
 * Replay-only entry to the championship moment. The dashboard layout owns
 * the auto-open gate for the same key; this gate never opens by itself.
 */
export function ChampionReplay(props: {
  saveId: string;
  teamId: string;
  view: ChampionMomentView;
}) {
  const gate = useMomentGate(
    props.saveId,
    momentKey("champion", props.teamId, props.view.seasonYear),
    { eligible: false },
  );
  return (
    <>
      <MomentReplayButton onReplay={gate.replay} label="Replay championship" />
      <ChampionMoment view={props.view} open={gate.open} onClose={gate.close} />
    </>
  );
}
