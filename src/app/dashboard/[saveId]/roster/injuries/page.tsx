import { InjuriesPageView } from "@/components/roster/InjuriesPageView";

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
  return <InjuriesPageView saveId={saveId} error={error} />;
}
