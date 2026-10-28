"use client";

import { momentKey, useMomentGate } from "@/components/moments";
import { AwardsNight } from "@/components/moments/AwardsNight";
import { ChampionMoment } from "@/components/moments/ChampionMoment";
import { ProgressionReveal } from "@/components/moments/ProgressionReveal";
import { SeasonRecap } from "@/components/moments/SeasonRecap";
import type { DashboardMomentsView } from "@/state/dashboard-moments";

/**
 * The dashboard's auto-opening moments. Each moment has exactly one eligible
 * gate, here; pages that hold the same facts use replay-only gates. Moments
 * never stack: awards night shows first, then the champion, then
 * the season recap, then progression.
 */
export function DashboardMoments(props: {
  saveId: string;
  moments: DashboardMomentsView | undefined;
}) {
  const teamId = props.moments?.teamId ?? "";
  const awards = props.moments?.awards ?? null;
  const champion = props.moments?.champion ?? null;
  const progression = props.moments?.progression ?? null;
  const recap = props.moments?.recap ?? null;
  const awardsGate = useMomentGate(
    props.saveId,
    momentKey("awards", teamId, awards?.seasonYear ?? 0),
    { eligible: awards?.isCurrent === true },
  );
  const championGate = useMomentGate(
    props.saveId,
    momentKey("champion", teamId, champion?.seasonYear ?? 0),
    { eligible: champion?.isCurrent === true && !awardsGate.open },
  );
  const recapGate = useMomentGate(
    props.saveId,
    momentKey("recap", teamId, recap?.seasonYear ?? 0),
    {
      eligible:
        recap?.isCurrent === true && !awardsGate.open && !championGate.open,
    },
  );
  const progressionGate = useMomentGate(
    props.saveId,
    momentKey("progression", teamId, progression?.seasonYear ?? 0),
    {
      eligible:
        progression?.isCurrent === true &&
        !awardsGate.open &&
        !championGate.open &&
        !recapGate.open,
    },
  );
  return (
    <>
      {awards ? (
        <AwardsNight
          view={awards}
          open={awardsGate.open}
          onClose={awardsGate.close}
        />
      ) : null}
      {champion ? (
        <ChampionMoment
          view={champion}
          open={championGate.open}
          onClose={championGate.close}
        />
      ) : null}
      {recap ? (
        <SeasonRecap
          view={recap}
          open={recapGate.open}
          onClose={recapGate.close}
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
