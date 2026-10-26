import { StaffEntityLink } from "@/components/entity/StaffEntityLink";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import type { StaffMemberView } from "@/state/franchise-selectors";
import type { StaffVacantRoleEntry } from "@/state/staff-hub-selectors";

import { cn, focusRingClass, linkClass } from "@/components/ui/styles";

const CELL = "px-4 py-3";

/**
 * Staff directory row — Role | Staff | Age | Salary | Contract | Specialty | Actions.
 */
export function StaffRow(props: { saveId: string; member: StaffMemberView }) {
  const { saveId, member } = props;
  return (
    <tr className="border-t border-line">
      <td className={`${CELL} text-muted`}>{member.roleLabel}</td>
      <td className={CELL}>
        <StaffEntityLink saveId={saveId} staffId={member.staffId}>
          {member.firstName} {member.lastName}
        </StaffEntityLink>
      </td>
      <td className={`${CELL} text-soft`}>{member.age}</td>
      <td className={CELL}>
        {member.annualSalary !== null ? (
          <MoneyDisplay amount={member.annualSalary} />
        ) : (
          "—"
        )}
      </td>
      <td className={`${CELL} text-muted`}>
        {member.yearsRemaining != null ? `${member.yearsRemaining}y` : "—"}
      </td>
      <td className={`${CELL} text-soft`}>{member.specialty}</td>
      <td className={`${CELL} text-faint`}>—</td>
    </tr>
  );
}

export function VacantStaffRow(props: {
  saveId: string;
  entry: StaffVacantRoleEntry;
}) {
  const href = `/dashboard/${props.saveId}/staff-coaching/hiring-market?role=${props.entry.role}`;
  return (
    <tr className="border-t border-line">
      <td className={`${CELL} text-muted`}>{props.entry.roleLabel}</td>
      <td className={`${CELL} font-medium text-team-ink`}>Vacant</td>
      <td className={`${CELL} text-disabled`}>—</td>
      <td className={`${CELL} text-disabled`}>—</td>
      <td className={`${CELL} text-disabled`}>—</td>
      <td className={`${CELL} text-disabled`}>—</td>
      <td className={CELL}>
        <a href={href} className={cn("text-sm", linkClass, focusRingClass)}>
          Find Staff
        </a>
      </td>
    </tr>
  );
}

export function StaffMemberCard(props: {
  saveId: string;
  member: StaffMemberView;
}) {
  const { saveId, member } = props;
  return (
    <article className="rounded-lg border border-line px-4 py-3">
      <p className="text-sm text-muted">{member.roleLabel}</p>
      <p className="mt-1 font-medium text-ink">
        <StaffEntityLink saveId={saveId} staffId={member.staffId}>
          {member.firstName} {member.lastName}
        </StaffEntityLink>
      </p>
      <p className="text-sm text-muted">Age {member.age}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-faint">Salary</dt>
          <dd className="text-ink">
            {member.annualSalary !== null ? (
              <MoneyDisplay amount={member.annualSalary} />
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-faint">Contract</dt>
          <dd className="text-ink">
            {member.yearsRemaining != null
              ? `${member.yearsRemaining} yrs`
              : "—"}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-faint">Specialty</dt>
          <dd className="text-ink">{member.specialty}</dd>
        </div>
      </dl>
    </article>
  );
}

export function VacantStaffCard(props: {
  saveId: string;
  entry: StaffVacantRoleEntry;
}) {
  const href = `/dashboard/${props.saveId}/staff-coaching/hiring-market?role=${props.entry.role}`;
  return (
    <article className="rounded-lg border border-dashed border-line-strong px-4 py-3">
      <p className="text-sm text-muted">{props.entry.roleLabel}</p>
      <p className="mt-1 font-medium text-team-ink">Vacant</p>
      <a
        href={href}
        className={cn("mt-2 inline-block text-sm", linkClass, focusRingClass)}
      >
        Find Staff
      </a>
    </article>
  );
}
