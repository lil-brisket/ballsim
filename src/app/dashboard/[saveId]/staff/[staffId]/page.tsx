import { notFound } from "next/navigation";
import Link from "next/link";
import { loadOwnerStaffDetail } from "@/application/game-service";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import {
  STAFF_ATTRIBUTE_KEYS,
  STAFF_ROLE_DISPLAY,
} from "@/domain/entities/staff-roles";
import type { StaffRole } from "@/domain/entities/staff";

type PageProps = {
  params: Promise<{ saveId: string; staffId: string }>;
};

export default async function StaffDetailPage({ params }: PageProps) {
  const { saveId, staffId } = await params;
  const loaded = await loadOwnerStaffDetail(saveId, staffId);
  if (!loaded) notFound();
  const staff = loaded.staff;

  const role = staff.role as StaffRole;
  const keys = STAFF_ATTRIBUTE_KEYS[role] as readonly string[];
  const attrs = staff.attributes as Record<string, number>;

  return (
    <>
      <PageHeader
        title={`${staff.firstName} ${staff.lastName}`}
        subtitle={STAFF_ROLE_DISPLAY[role]}
      />
      <p className="mb-4 text-sm text-zinc-400">
        <Link
          href={`/dashboard/${saveId}/staff`}
          className="hover:text-amber-400"
        >
          ← Back to staff
        </Link>
      </p>

      <Section title="Overview">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-zinc-500">Overall</dt>
            <dd className="text-lg font-semibold text-zinc-100">
              {staff.overall}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Potential</dt>
            <dd className="text-lg font-semibold text-zinc-100">
              {staff.potential}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Age</dt>
            <dd className="text-lg font-semibold text-zinc-100">{staff.age}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Experience</dt>
            <dd className="text-lg font-semibold text-zinc-100">
              {staff.experience} yrs
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Trend</dt>
            <dd className="text-zinc-100 capitalize">
              {staff.development.trend}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Morale</dt>
            <dd className="text-zinc-100">{staff.morale}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Desired salary</dt>
            <dd className="text-zinc-100">
              <MoneyDisplay amount={staff.preferences.desiredSalary} />
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Min salary</dt>
            <dd className="text-zinc-100">
              <MoneyDisplay amount={staff.preferences.minimumSalary} />
            </dd>
          </div>
        </dl>
      </Section>

      <Section title="Attributes">
        <ul className="space-y-1 text-sm">
          {keys.map((key) => (
            <li
              key={key}
              className="flex justify-between border-b border-zinc-900 py-1"
            >
              <span className="text-zinc-400">
                {key
                  .replace(/([A-Z])/g, " $1")
                  .replace(/^./, (c) => c.toUpperCase())}
              </span>
              <span className="font-medium text-zinc-100">{attrs[key]}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Preferences">
        <ul className="space-y-1 text-sm text-zinc-300">
          <li>Salary focus: {staff.preferences.salaryWeight}/100</li>
          <li>Security focus: {staff.preferences.securityWeight}/100</li>
          <li>Winning focus: {staff.preferences.winningWeight}/100</li>
          <li>
            Preferred contract: {staff.preferences.preferredContractYears} years
          </li>
          {staff.preferences.preferredRole ? (
            <li>
              Career goal: {STAFF_ROLE_DISPLAY[staff.preferences.preferredRole]}
            </li>
          ) : null}
        </ul>
      </Section>

      <Section title="Career history">
        {staff.careerHistory.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No major career events recorded.
          </p>
        ) : (
          <ul className="space-y-1 text-sm text-zinc-300">
            {[...staff.careerHistory].reverse().map((entry, i) => (
              <li key={`${entry.seasonYear}-${entry.kind}-${i}`}>
                {entry.seasonYear}: {entry.kind}
                {entry.teamId ? ` (${entry.teamId})` : ""} — OVR {entry.overall}
                {entry.note ? ` — ${entry.note}` : ""}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
