import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { loadSaveWithHistory } from "@/application/game-service";
import { AwardsNightReplay } from "@/components/history/AwardsNightReplay";
import { HistoryHub } from "@/components/history/HistoryHub";
import { AwardsViewSwitch } from "@/components/history/AwardsViewSwitch";
import { historyHubHref } from "@/components/history/history-hub-links";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import { toAwardsNightView } from "@/state/awards-night-selectors";
import {
  misroutedHistoryHubTab,
  toHistoryHubView,
  type HistoryHubParams,
} from "@/state/history-hub-selectors";

export const metadata: Metadata = { title: "Awards" };

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<HistoryHubParams>;
};

export default async function AwardsPage({ params, searchParams }: PageProps) {
  const { saveId } = await params;
  const query = await searchParams;
  const misrouted = misroutedHistoryHubTab("awards", query);
  if (misrouted) {
    redirect(historyHubHref(saveId, misrouted, query));
  }
  // Long-retired players and old seasons live in the stored history.
  const loaded = await loadSaveWithHistory(saveId);
  if (!loaded) {
    notFound();
  }

  const awardsNight = toAwardsNightView(loaded.state);
  return (
    <>
      <AwardsViewSwitch saveId={saveId} active="awards" />
      {awardsNight ? (
        <AwardsNightReplay
          saveId={saveId}
          teamId={getActiveOwnerTeamId(loaded.state)}
          view={awardsNight}
        />
      ) : null}
      <HistoryHub view={toHistoryHubView(loaded.state, "awards", query)} />
    </>
  );
}
