import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Deprecated: Lineup & Rotation lives at /team-management/lineups. */
export default async function RotationsRedirectPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const query = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") {
      qs.set(key, value);
    } else if (Array.isArray(value) && value[0] != null) {
      qs.set(key, value[0]);
    }
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  redirect(`/dashboard/${saveId}/team-management/lineups${suffix}`);
}
