"use client";

import dynamic from "next/dynamic";
import type { DashboardMomentsView } from "@/state/dashboard-moments";

/*
 * Moments open only after hydration (the gate's server snapshot is "seen"),
 * so their code loads on demand, and only when the save has one to show.
 */
const DashboardMoments = dynamic(
  () =>
    import("@/components/moments/DashboardMoments").then(
      (module) => module.DashboardMoments,
    ),
  { ssr: false },
);

export function LazyDashboardMoments(props: {
  saveId: string;
  moments: DashboardMomentsView | undefined;
}) {
  const moments = props.moments;
  if (
    !moments ||
    (!moments.awards &&
      !moments.champion &&
      !moments.recap &&
      !moments.progression)
  ) {
    return null;
  }
  return <DashboardMoments saveId={props.saveId} moments={moments} />;
}
