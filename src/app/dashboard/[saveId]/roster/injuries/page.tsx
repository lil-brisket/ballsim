import type { Metadata } from "next";
import { HubPageSwitch } from "@/components/game/shell/HubPageSwitch";
import { InjuriesPageView } from "@/components/roster/InjuriesPageView";

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
      <HubPageSwitch saveId={saveId} pair="roster" active="injuries" />
      <InjuriesPageView saveId={saveId} error={error} />
    </>
  );
}
