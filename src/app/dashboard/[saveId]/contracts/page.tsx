import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Legacy route — redirects to Team Hub Contracts. */
export default async function ContractsRedirectPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const query = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") {
      qs.set(key, value);
    }
  }
  const suffix = qs.toString();
  redirect(`/dashboard/${saveId}/team/contracts${suffix ? `?${suffix}` : ""}`);
}
