import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Legacy Team Management coaching — redirects to Staff & Coaching hub. */
export default async function CoachingRedirectPage({
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
  redirect(
    `/dashboard/${saveId}/staff-coaching/coaching${suffix ? `?${suffix}` : ""}`,
  );
}
