"use client";

import {
  MomentReplayButton,
  momentKey,
  useMomentGate,
} from "@/components/moments";
import { AwardsNight } from "@/components/moments/AwardsNight";
import type { AwardsNightView } from "@/state/awards-night-selectors";

/**
 * Replay-only entry to awards night. The dashboard layout owns the auto-open
 * gate for the same key; this gate never opens by itself.
 */
export function AwardsNightReplay(props: {
  saveId: string;
  teamId: string;
  view: AwardsNightView;
}) {
  const gate = useMomentGate(
    props.saveId,
    momentKey("awards", props.teamId, props.view.seasonYear),
    { eligible: false },
  );
  return (
    <div className="mb-4">
      <MomentReplayButton
        onReplay={gate.replay}
        label={`Replay ${props.view.seasonYear} awards night`}
      />
      <AwardsNight view={props.view} open={gate.open} onClose={gate.close} />
    </div>
  );
}
