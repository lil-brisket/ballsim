"use client";

import { momentKey, useMomentGate } from "@/components/moments";
import { ChampionMoment } from "@/components/moments/ChampionMoment";
import { ProgressionReveal } from "@/components/moments/ProgressionReveal";
import type { DashboardMomentsView } from "@/state/dashboard-moments";

/**
 * The dashboard's auto-opening moments. Each moment has exactly one eligible
 * gate, here; pages that hold the same facts use replay-only gates. Moments
 * never stack: the champion shows first, then progression.
 */
export function DashboardMoments(props: {
  saveId: string;
  moments: DashboardMomentsView | undefined;
}) {
  const teamId = props.moments?.teamId ?? "";
  const champion = props.moments?.champion ?? null;
  const progression = props.moments?.progression ?? null;
  const championGate = useMomentGate(
    props.saveId,
    momentKey("champion", teamId, champion?.seasonYear ?? 0),
    { eligible: champion?.isCurrent === true },
  );
  const progressionGate = useMomentGate(
    props.saveId,
    momentKey("progression", teamId, progression?.seasonYear ?? 0),
    { eligible: progression?.isCurrent === true && !championGate.open },
  );
  return (
    <>
      {champion ? (
        <ChampionMoment
          view={champion}
          open={championGate.open}
          onClose={championGate.close}
        />
      ) : null}
      {progression ? (
        <ProgressionReveal
          view={progression}
          open={progressionGate.open}
          onClose={progressionGate.close}
        />
      ) : null}
    </>
  );
}
