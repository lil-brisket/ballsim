import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Backward-compatible redirect into Media Hub transactions tab. */
export default async function TransactionsRedirectPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const query = await searchParams;
  const qs = new URLSearchParams();
  qs.set("tab", "transactions");
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string" && key !== "tab") {
      qs.set(key, value);
    }
  }
  redirect(`/dashboard/${saveId}/media?${qs.toString()}`);
}
