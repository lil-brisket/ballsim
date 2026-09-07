import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ saveId: string }>;
};

/** Legacy Team Management overview — redirects to Team. */
export default async function TeamManagementRedirectPage({
  params,
}: PageProps) {
  const { saveId } = await params;
  redirect(`/dashboard/${saveId}/team`);
}
