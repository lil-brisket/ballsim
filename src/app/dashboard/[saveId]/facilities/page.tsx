import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

/** Facilities moved under Finances (Issue #189); keep old links working. */
export default async function FacilitiesRedirectPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const query = error ? `?error=${encodeURIComponent(error)}` : "";
  redirect(`/dashboard/${saveId}/finances/facilities${query}`);
}
