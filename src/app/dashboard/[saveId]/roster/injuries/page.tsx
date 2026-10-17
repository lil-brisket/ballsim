import type { Metadata } from "next";
import { InjuriesPageView } from "@/components/roster/InjuriesPageView";
import { TeamHubSubNav } from "@/components/team/TeamHubSubNav";

export const metadata: Metadata = { title: "Injuries" };

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function RosterInjuriesPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  return (
    <>
      <TeamHubSubNav saveId={saveId} active="injuries" />
      <InjuriesPageView saveId={saveId} error={error} />
    </>
  );
}
