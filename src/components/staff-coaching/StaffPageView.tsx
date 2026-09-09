import Link from "next/link";
import { hireStaffAction } from "@/application/actions";
import { StaffEntityLink } from "@/components/entity/StaffEntityLink";
import { ManagementDecisionPanel } from "@/components/management/ManagementDecisionPanel";
import { DataTable } from "@/components/owner/DataTable";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { StaffRow } from "@/components/staff-coaching/StaffRow";
import type { StaffHubView } from "@/state/staff-hub-selectors";
import type { StaffMemberView } from "@/state/franchise-selectors";

/**
 * Staff Hub — Vacancies/decisions → Staff Directory → Hiring market.
 * Terminology: Staff Directory (not roster).
 */
export function StaffPageView(props: {
  view: StaffHubView;
  returnPath: string;
  filterBasePath: string;
  error?: string;
  role?: string;
  sort?: string;
}) {
  const { view, returnPath, filterBasePath, error, role, sort } = props;
  const saveId = view.saveId;

  let available = [...view.available];
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
    <div className="space-y-4">
      <PageHeader
        title="Staff"
        subtitle="Who is operating the organization"
        actions={
          <StaffHeaderStrip view={view} />
        }
      />
      {error ? <ErrorState message={error} /> : null}

      {/* 1. Vacancies / decisions */}
      <ManagementDecisionPanel
        title="Staff Decisions"
        items={view.decisions}
        saveId={saveId}
        currentDate={view.currentDate}
        emptyMessage={
          view.vacancyCount > 0
            ? `${view.vacancyCount} starter role${view.vacancyCount === 1 ? "" : "s"} vacant — review the hiring market below.`
            : "No staff decisions need attention right now."
        }
      />

      {view.vacancyCount > 0 ? (
        <Section title="Vacancies">
          <p className="text-sm text-zinc-400">
            Missing starter roles:{" "}
            <span className="text-amber-300">
              {view.vacantRoles.join(", ")}
            </span>
          </p>
        </Section>
      ) : null}

      {/* 2. Staff Directory (organizational state) */}
      <Section title="Staff Directory">
        {view.directory.length === 0 ? (
          <EmptyState message="No staff on this franchise." />
        ) : (
          <div className="space-y-6">
            {view.directory.map((group) => (
              <div key={group.role}>
                <h3 className="mb-2 text-sm font-medium text-zinc-200">
                  {group.roleLabel}
                  <span className="ml-2 text-xs font-normal text-zinc-500">
                    ({group.members.length})
                  </span>
                </h3>
                <div className="overflow-x-auto">
                  <DataTable
                    headers={[
                      "Staff",
                      "OVR",
                      "POT",
                      "Salary",
                      "Contract",
                      "Trend",
                      "Strengths",
                      "Action",
                    ]}
                  >
                    {group.members.map((member) => (
                      <StaffRow
                        key={member.staffId}
                        saveId={saveId}
                        member={member}
                        returnPath={returnPath}
                      />
                    ))}
                  </DataTable>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 3. Hiring market (action/workflow) */}
      <Section title="Hiring Market">
        <p className="mb-3 text-sm text-zinc-500">
          Free-agent staff available to hire — separate from your current
          directory.
        </p>
        <div className="mb-3 flex flex-wrap gap-2 text-sm">
          <Link
            href={filterBasePath}
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
              href={`${filterBasePath}?role=${r}`}
              className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-amber-600"
            >
              {r.replaceAll("_", " ")}
            </Link>
          ))}
          <Link
            href={`${filterBasePath}?sort=potential${role ? `&role=${role}` : ""}`}
            className="rounded border border-zinc-700 px-2 py-1 text-zinc-300"
          >
            Sort: Potential
          </Link>
          <Link
            href={`${filterBasePath}?sort=salary${role ? `&role=${role}` : ""}`}
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
              <HireMarketRow
                key={member.staffId}
                saveId={saveId}
                member={member}
                returnPath={returnPath}
              />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function StaffHeaderStrip(props: { view: StaffHubView }) {
  const { view } = props;
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-right text-xs text-zinc-400">
      <div>
        <dt className="uppercase tracking-wide text-zinc-600">Head coach</dt>
        <dd className="text-zinc-200">
          {view.headCoach
            ? `${view.headCoach.firstName} ${view.headCoach.lastName}`
            : "Vacant"}
        </dd>
      </div>
      <div>
        <dt className="uppercase tracking-wide text-zinc-600">Staff</dt>
        <dd className="text-zinc-200">{view.staffCount}</dd>
      </div>
      <div>
        <dt className="uppercase tracking-wide text-zinc-600">Vacancies</dt>
        <dd className="text-zinc-200">{view.vacancyCount}</dd>
      </div>
    </dl>
  );
}

function HireMarketRow(props: {
  saveId: string;
  member: StaffMemberView;
  returnPath: string;
}) {
  const { saveId, member, returnPath } = props;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 px-4 py-3">
      <div>
        <p className="font-medium text-zinc-100">
          <StaffEntityLink saveId={saveId} staffId={member.staffId}>
            {member.firstName} {member.lastName}
          </StaffEntityLink>
        </p>
        <p className="text-sm text-zinc-400">
          {member.roleLabel} · OVR {member.overall} · POT {member.potential} ·
          Age {member.age}
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
  );
}
