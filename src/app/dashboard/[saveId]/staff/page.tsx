import { notFound } from "next/navigation";
import Link from "next/link";
import { fireStaffAction, hireStaffAction } from "@/application/actions";
import { loadOwnerSaveView } from "@/application/game-service";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string; role?: string; sort?: string }>;
};

function trendBadge(trend: string): string {
  if (trend === "improving") return "↑ Improving";
  if (trend === "declining") return "↓ Declining";
  return "→ Stable";
}

export default async function StaffPage({ params, searchParams }: PageProps) {
  const { saveId } = await params;
  const { error, role, sort } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }
  const returnPath = `/dashboard/${saveId}/staff`;

  let available = [...view.staff.available];
  if (role) {
    available = available.filter((m) => m.role === role);
  }
  if (sort === "potential") {
    available.sort((a, b) => b.potential - a.potential);
  } else if (sort === "salary") {
    available.sort((a, b) => a.desiredSalary - b.desiredSalary);
  } else {
    available.sort((a, b) => b.overall - a.overall);
  }

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle="Manage coaching, medical, scouting, and front-office staff"
      />
      {error ? <ErrorState message={error} /> : null}

      <Section title="Current staff">
        {view.staff.roster.length === 0 ? (
          <EmptyState message="No staff on this franchise." />
        ) : (
          <ul className="space-y-2">
            {view.staff.roster.map((member) => (
              <li
                key={member.staffId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-zinc-100">
                    <Link
                      href={`/dashboard/${saveId}/staff/${member.staffId}`}
                      className="hover:text-amber-400"
                    >
                      {member.firstName} {member.lastName}
                    </Link>
                  </p>
                  <p className="text-sm text-zinc-400">
                    {member.roleLabel} · OVR {member.overall} · POT{" "}
                    {member.potential} · Age {member.age} ·{" "}
                    {member.experience} yrs · {trendBadge(member.trend)}
                    {member.yearsRemaining != null ? (
                      <> · {member.yearsRemaining}y left</>
                    ) : null}
                    {member.annualSalary != null ? (
                      <>
                        {" "}
                        · <MoneyDisplay amount={member.annualSalary} />
                      </>
                    ) : null}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Strengths: {member.strengths.join(", ") || "—"}
                  </p>
                </div>
                <form action={fireStaffAction}>
                  <input type="hidden" name="saveId" value={saveId} />
                  <input type="hidden" name="staffId" value={member.staffId} />
                  <input type="hidden" name="returnPath" value={returnPath} />
                  <button
                    type="submit"
                    className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-red-500"
                  >
                    Fire
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Available free agents">
        <div className="mb-3 flex flex-wrap gap-2 text-sm">
          <Link
            href={`/dashboard/${saveId}/staff`}
            className="rounded border border-zinc-700 px-2 py-1 text-zinc-300"
          >
            All
          </Link>
          {[
            "head_coach",
            "assistant_coach",
            "trainer",
            "scout",
            "medical",
            "general_manager",
            "finance",
            "public_relations",
          ].map((r) => (
            <Link
              key={r}
              href={`/dashboard/${saveId}/staff?role=${r}`}
              className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-amber-600"
            >
              {r.replaceAll("_", " ")}
            </Link>
          ))}
          <Link
            href={`/dashboard/${saveId}/staff?sort=potential${role ? `&role=${role}` : ""}`}
            className="rounded border border-zinc-700 px-2 py-1 text-zinc-300"
          >
            Sort: Potential
          </Link>
          <Link
            href={`/dashboard/${saveId}/staff?sort=salary${role ? `&role=${role}` : ""}`}
            className="rounded border border-zinc-700 px-2 py-1 text-zinc-300"
          >
            Sort: Salary
          </Link>
        </div>
        {available.length === 0 ? (
          <EmptyState message="No unemployed staff available." />
        ) : (
          <ul className="space-y-2">
            {available.slice(0, 40).map((member) => (
              <li
                key={member.staffId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-zinc-100">
                    <Link
                      href={`/dashboard/${saveId}/staff/${member.staffId}`}
                      className="hover:text-amber-400"
                    >
                      {member.firstName} {member.lastName}
                    </Link>
                  </p>
                  <p className="text-sm text-zinc-400">
                    {member.roleLabel} · OVR {member.overall} · POT{" "}
                    {member.potential} · Age {member.age}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Wants ~<MoneyDisplay amount={member.desiredSalary} /> · Min{" "}
                    <MoneyDisplay amount={member.minimumSalary} />
                  </p>
                </div>
                <form action={hireStaffAction}>
                  <input type="hidden" name="saveId" value={saveId} />
                  <input type="hidden" name="staffId" value={member.staffId} />
                  <input type="hidden" name="returnPath" value={returnPath} />
                  <button
                    type="submit"
                    className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-500"
                  >
                    Hire
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
