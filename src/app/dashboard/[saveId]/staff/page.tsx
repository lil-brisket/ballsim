import { notFound } from "next/navigation";
import { fireStaffAction, hireStaffAction } from "@/application/actions";
import { loadOwnerSaveView } from "@/application/game-service";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function StaffPage({ params, searchParams }: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }
  const returnPath = `/dashboard/${saveId}/staff`;

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle="Hire and release front-office and coaching staff"
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
                    {member.firstName} {member.lastName}
                  </p>
                  <p className="text-sm text-zinc-400">
                    {member.role.replaceAll("_", " ")} · Q{member.quality} ·{" "}
                    {member.experience} yrs
                    {member.annualSalary != null ? (
                      <>
                        {" "}
                        · <MoneyDisplay amount={member.annualSalary} />
                      </>
                    ) : null}
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
        {view.staff.available.length === 0 ? (
          <EmptyState message="No unemployed staff available." />
        ) : (
          <ul className="space-y-2">
            {view.staff.available.slice(0, 24).map((member) => (
              <li
                key={member.staffId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-zinc-100">
                    {member.firstName} {member.lastName}
                  </p>
                  <p className="text-sm text-zinc-400">
                    {member.role.replaceAll("_", " ")} · Q{member.quality}
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
