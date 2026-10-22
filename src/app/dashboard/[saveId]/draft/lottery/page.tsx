import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestSaveStore } from "@/application/request-save-store";
import { LotteryNight } from "@/components/draft/LotteryNight";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { toDraftLotteryView } from "@/state/draft-lottery-selectors";
import { draftYearForSeason } from "@/systems/draft";

export const metadata: Metadata = { title: "Lottery night" };

type LotteryPageProps = {
  params: Promise<{ saveId: string }>;
};

export default async function LotteryPage({ params }: LotteryPageProps) {
  const { saveId } = await params;
  const loaded = await getRequestSaveStore().load(saveId);
  if (!loaded) {
    notFound();
  }
  const view = toDraftLotteryView(loaded.state);
  const nextYear = draftYearForSeason(loaded.state.competition.season.year);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lottery night"
        subtitle={view ? `${view.draftYear} draft` : undefined}
        actions={
          <Link
            href={`/dashboard/${saveId}/draft`}
            className={buttonClass({ variant: "secondary" })}
          >
            Back to draft
          </Link>
        }
      />
      {view ? (
        <LotteryNight view={view} />
      ) : (
        <EmptyState
          message={`No lottery for the ${nextYear} draft yet. It is drawn when draft preparation begins.`}
        />
      )}
    </div>
  );
}
