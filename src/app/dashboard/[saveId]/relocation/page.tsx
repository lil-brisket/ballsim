import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

/** Relocation moved under Franchise (Issue #190); keep old links working. */
export default async function RelocationRedirectPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const query = error ? `?error=${encodeURIComponent(error)}` : "";
  redirect(`/dashboard/${saveId}/franchise/relocation${query}`);
}
