import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRequestSaveStore } from "@/application/request-save-store";
import { PlayerCompareBoard } from "@/components/player-compare/PlayerCompareBoard";
import { PageHeader } from "@/components/ui/PageHeader";
import { toPlayerCompareView } from "@/state/player-compare";

export const metadata: Metadata = { title: "Compare players" };

type ComparePageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ a?: string | string[]; b?: string | string[] }>;
};

function first(value: string | string[] | undefined): string | null {
  const single = Array.isArray(value) ? value[0] : value;
  return single ? single : null;
}

export default async function ComparePlayersPage({
  params,
  searchParams,
}: ComparePageProps) {
  const { saveId } = await params;
  const query = await searchParams;
  const loaded = await getRequestSaveStore().load(saveId);
  if (!loaded) {
    notFound();
  }
  const a = toPlayerCompareView(loaded.state, first(query.a));
  const b = toPlayerCompareView(loaded.state, first(query.b));

  return (
    <>
      <PageHeader
        title="Compare players"
        subtitle="Differences show the second player minus the first."
      />
      <div className="mt-6">
        <PlayerCompareBoard saveId={saveId} a={a} b={b} />
      </div>
    </>
  );
}
