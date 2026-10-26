import { redirect } from "next/navigation";
import { searchParamsFromRecord } from "@/state/standings-page-params";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Legacy route — Transactions is a League tab since Issue #186. */
export default async function TransactionsRedirectPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const suffix = searchParamsFromRecord(await searchParams).toString();
  redirect(
    `/dashboard/${saveId}/league/transactions${suffix ? `?${suffix}` : ""}`,
  );
}
