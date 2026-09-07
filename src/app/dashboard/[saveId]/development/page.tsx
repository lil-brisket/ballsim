import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ saveId: string }>;
};

/** Canonical Development alias → Development League page. */
export default async function DevelopmentRedirectPage({ params }: PageProps) {
  const { saveId } = await params;
  redirect(`/dashboard/${saveId}/development-league`);
}
