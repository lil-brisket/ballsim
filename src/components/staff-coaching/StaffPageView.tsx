import { DataTable } from "@/components/owner/DataTable";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { Metric } from "@/components/ui/Metric";
import {
  StaffMemberCard,
  StaffRow,
  VacantStaffCard,
  VacantStaffRow,
} from "@/components/staff-coaching/StaffRow";
import type { StaffHubView } from "@/state/staff-hub-selectors";

/**
 * Staff Hub — payroll summary + directory with inline vacancies.
 */
export function StaffPageView(props: { view: StaffHubView; error?: string }) {
  const { view, error } = props;
  const saveId = view.saveId;
  const members = view.directory.flatMap((group) => group.members);
  const hasRows = members.length > 0 || view.vacantRoleEntries.length > 0;

  return (
    <div className="space-y-4">
      <PageHeader title="Staff" subtitle="Who is operating the organization" />
      {error ? <ErrorState message={error} /> : null}

      <StaffPayrollCard view={view} />

      <Section title="Staff Directory">
        {!hasRows ? (
          <EmptyState message="No staff on this franchise." />
        ) : (
          <>
            <div className="hidden md:block">
              <DataTable
                caption="Current staff and vacant starter roles"
                headers={[
                  "Role",
                  "Staff",
                  "Age",
                  "Salary",
                  "Contract",
                  "Specialty",
                  "Actions",
                ]}
              >
                {members.map((member) => (
                  <StaffRow
                    key={member.staffId}
                    saveId={saveId}
                    member={member}
                  />
                ))}
                {view.vacantRoleEntries.map((entry) => (
                  <VacantStaffRow
                    key={entry.role}
                    saveId={saveId}
                    entry={entry}
                  />
                ))}
              </DataTable>
            </div>
            <div className="space-y-3 md:hidden">
              {members.map((member) => (
                <StaffMemberCard
                  key={member.staffId}
                  saveId={saveId}
                  member={member}
                />
              ))}
              {view.vacantRoleEntries.map((entry) => (
                <VacantStaffCard
                  key={entry.role}
                  saveId={saveId}
                  entry={entry}
                />
              ))}
            </div>
          </>
        )}
      </Section>
    </div>
  );
}

function StaffPayrollCard(props: { view: StaffHubView }) {
  const { budget } = props.view;
  const over = budget.overBudget;
  return (
    <div
      className={`flex flex-wrap gap-x-6 gap-y-3 rounded-xl border px-4 py-3 ${
        over
          ? "border-rose-800/80 bg-rose-950/20"
          : "border-zinc-800 bg-zinc-900/40"
      }`}
      aria-label="Staff payroll and budget"
    >
      <Metric
        label="Committed payroll"
        value={<MoneyDisplay amount={budget.payroll} />}
        density="compact"
      />
      <Metric
        label="Remaining"
        value={<MoneyDisplay amount={budget.remaining} />}
        density="compact"
      />
      <Metric
        label="Total budget"
        value={<MoneyDisplay amount={budget.total} />}
        density="compact"
      />
      <Metric
        label="Used"
        value={`${budget.percentageUsed}%`}
        density="compact"
      />
      {over ? (
        <Metric
          label="Over budget"
          value={<MoneyDisplay amount={budget.amountOver} />}
          density="compact"
        />
      ) : null}
    </div>
  );
}
