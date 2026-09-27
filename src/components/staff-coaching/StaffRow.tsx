import { StaffEntityLink } from "@/components/entity/StaffEntityLink";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import type { StaffMemberView } from "@/state/franchise-selectors";
import type { StaffVacantRoleEntry } from "@/state/staff-hub-selectors";

const CELL = "px-4 py-3";

/**
 * Staff directory row — Role | Staff | Age | Salary | Contract | Specialty | Actions.
 */
export function StaffRow(props: { saveId: string; member: StaffMemberView }) {
  const { saveId, member } = props;
  return (
    <tr className="border-t border-zinc-800">
      <td className={`${CELL} text-zinc-400`}>{member.roleLabel}</td>
      <td className={CELL}>
        <StaffEntityLink saveId={saveId} staffId={member.staffId}>
          {member.firstName} {member.lastName}
        </StaffEntityLink>
      </td>
      <td className={`${CELL} text-zinc-300`}>{member.age}</td>
      <td className={CELL}>
        {member.annualSalary !== null ? (
          <MoneyDisplay amount={member.annualSalary} />
        ) : (
          "—"
        )}
      </td>
      <td className={`${CELL} text-zinc-400`}>
        {member.yearsRemaining != null ? `${member.yearsRemaining}y` : "—"}
      </td>
      <td className={`${CELL} text-zinc-300`}>{member.specialty}</td>
      <td className={`${CELL} text-zinc-500`}>—</td>
    </tr>
  );
}

export function VacantStaffRow(props: {
  saveId: string;
  entry: StaffVacantRoleEntry;
}) {
  const href = `/dashboard/${props.saveId}/staff-coaching/hiring-market?role=${props.entry.role}`;
  return (
    <tr className="border-t border-zinc-800">
      <td className={`${CELL} text-zinc-400`}>{props.entry.roleLabel}</td>
      <td
        className={`${CELL} font-medium uppercase tracking-wide text-amber-400`}
      >
        Vacant
      </td>
      <td className={`${CELL} text-zinc-600`}>—</td>
      <td className={`${CELL} text-zinc-600`}>—</td>
      <td className={`${CELL} text-zinc-600`}>—</td>
      <td className={`${CELL} text-zinc-600`}>—</td>
      <td className={CELL}>
        <a href={href} className="text-sm text-amber-400 hover:underline">
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
    <article className="rounded-lg border border-zinc-800 px-4 py-3">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
        {member.roleLabel}
      </p>
      <p className="mt-1 font-medium text-zinc-100">
        <StaffEntityLink saveId={saveId} staffId={member.staffId}>
          {member.firstName} {member.lastName}
        </StaffEntityLink>
      </p>
      <p className="text-sm text-zinc-400">Age {member.age}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-zinc-500">Salary</dt>
          <dd className="text-zinc-200">
            {member.annualSalary !== null ? (
              <MoneyDisplay amount={member.annualSalary} />
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Contract</dt>
          <dd className="text-zinc-200">
            {member.yearsRemaining != null
              ? `${member.yearsRemaining} yrs`
              : "—"}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-zinc-500">Specialty</dt>
          <dd className="text-zinc-200">{member.specialty}</dd>
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
    <article className="rounded-lg border border-dashed border-zinc-700 px-4 py-3">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
        {props.entry.roleLabel}
      </p>
      <p className="mt-1 font-medium uppercase tracking-wide text-amber-400">
        Vacant
      </p>
      <a
        href={href}
        className="mt-2 inline-block text-sm text-amber-400 hover:underline"
      >
        Find Staff
      </a>
    </article>
  );
}
