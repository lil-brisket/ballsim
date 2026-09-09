import { fireStaffAction } from "@/application/actions";
import { StaffEntityLink } from "@/components/entity/StaffEntityLink";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { StatusBadge } from "@/components/owner/StatusBadge";
import type { StaffMemberView } from "@/state/franchise-selectors";

function trendTone(
  trend: string,
): "success" | "warning" | "critical" | "neutral" {
  if (trend === "improving") return "success";
  if (trend === "declining") return "critical";
  return "neutral";
}

/**
 * Dense staff directory row — not a player roster row.
 */
export function StaffRow(props: {
  saveId: string;
  member: StaffMemberView;
  returnPath: string;
}) {
  const { saveId, member, returnPath } = props;
  return (
    <tr className="border-t border-zinc-800">
      <td className="px-3 py-2">
        <StaffEntityLink saveId={saveId} staffId={member.staffId}>
          {member.firstName} {member.lastName}
        </StaffEntityLink>
        <p className="text-xs text-zinc-500">
          Age {member.age} · {member.experience} yrs exp
        </p>
      </td>
      <td className="px-3 py-2 text-zinc-300">{member.overall}</td>
      <td className="px-3 py-2 text-zinc-400">{member.potential}</td>
      <td className="px-3 py-2">
        {member.annualSalary !== null ? (
          <MoneyDisplay amount={member.annualSalary} />
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2 text-zinc-400">
        {member.yearsRemaining != null ? `${member.yearsRemaining}y` : "—"}
      </td>
      <td className="px-3 py-2">
        <StatusBadge label={member.trend} tone={trendTone(member.trend)} />
      </td>
      <td className="px-3 py-2 text-xs text-zinc-500">
        {member.strengths.slice(0, 2).join(", ") || "—"}
      </td>
      <td className="px-3 py-2">
        <form action={fireStaffAction}>
          <input type="hidden" name="saveId" value={saveId} />
          <input type="hidden" name="staffId" value={member.staffId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <button
            type="submit"
            className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:border-red-500"
          >
            Fire
          </button>
        </form>
      </td>
    </tr>
  );
}
