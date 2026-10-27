import {
  cn,
  focusRingClass,
  touchTargetTextClass,
} from "@/components/ui/styles";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { loadOwnerStaffDetail } from "@/application/game-service";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import {
  STAFF_ATTRIBUTE_KEYS,
  STAFF_ROLE_DISPLAY,
} from "@/domain/entities/staff-roles";
import type { StaffRole } from "@/domain/entities/staff";

export const metadata: Metadata = { title: "Staff Member" };

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
      <p className="mb-4 text-sm text-muted">
        <Link
          href={`/dashboard/${saveId}/staff-coaching/staff`}
          className={cn(
            touchTargetTextClass,
            "hover:text-team-ink",
            focusRingClass,
          )}
        >
          ← Back to staff
        </Link>
      </p>

      <Section title="Overview">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-faint">Overall</dt>
            <dd className="text-lg font-semibold text-ink">{staff.overall}</dd>
          </div>
          <div>
            <dt className="text-faint">Potential</dt>
            <dd className="text-lg font-semibold text-ink">
              {staff.potential}
            </dd>
          </div>
          <div>
            <dt className="text-faint">Age</dt>
            <dd className="text-lg font-semibold text-ink">{staff.age}</dd>
          </div>
          <div>
            <dt className="text-faint">Experience</dt>
            <dd className="text-lg font-semibold text-ink">
              {staff.experience} yrs
            </dd>
          </div>
          <div>
            <dt className="text-faint">Trend</dt>
            <dd className="text-ink capitalize">{staff.development.trend}</dd>
          </div>
          <div>
            <dt className="text-faint">Morale</dt>
            <dd className="text-ink">{staff.morale}</dd>
          </div>
          <div>
            <dt className="text-faint">Desired salary</dt>
            <dd className="text-ink">
              <MoneyDisplay amount={staff.preferences.desiredSalary} />
            </dd>
          </div>
          <div>
            <dt className="text-faint">Min salary</dt>
            <dd className="text-ink">
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
              className="flex justify-between border-b border-surface-raised py-1"
            >
              <span className="text-muted">
                {key
                  .replace(/([A-Z])/g, " $1")
                  .replace(/^./, (c) => c.toUpperCase())}
              </span>
              <span className="font-medium text-ink">{attrs[key]}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Preferences">
        <ul className="space-y-1 text-sm text-soft">
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
          <p className="text-sm text-faint">No major career events recorded.</p>
        ) : (
          <ul className="space-y-1 text-sm text-soft">
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
