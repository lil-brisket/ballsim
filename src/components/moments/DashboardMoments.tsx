"use client";

import { momentKey, useMomentGate } from "@/components/moments";
import { ProgressionReveal } from "@/components/moments/ProgressionReveal";
import type { DashboardMomentsView } from "@/state/dashboard-moments";

/**
 * The dashboard's auto-opening moments. Each moment has exactly one eligible
 * gate, here; pages that hold the same facts use replay-only gates.
 */
export function DashboardMoments(props: {
  saveId: string;
  moments: DashboardMomentsView | undefined;
}) {
  const progression = props.moments?.progression ?? null;
  const gate = useMomentGate(
    props.saveId,
    momentKey(
      "progression",
      props.moments?.teamId ?? "",
      progression?.seasonYear ?? 0,
    ),
    { eligible: progression?.isCurrent === true },
  );
  if (!progression) return null;
  return (
    <ProgressionReveal
      view={progression}
      open={gate.open}
      onClose={gate.close}
    />
  );
}
