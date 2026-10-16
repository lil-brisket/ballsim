import Link from "next/link";
import { CardTable } from "@/components/player-profile/CardTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { Section } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { PlayerProfileView } from "@/state/player-profile-selectors";

export function PlayerContract(props: {
  player: PlayerProfileView;
  saveId: string;
}) {
  const profile = props.player.contractProfile;

  if (!profile) {
    return (
      <Section title="Contract">
        <EmptyState message="No contract on file." />
      </Section>
    );
  }

  return (
    <div className="space-y-6">
      <Section
        title="Current contract"
        action={
          <Link
            href={`/dashboard/${props.saveId}/contracts`}
            className="text-sm text-team-ink underline-offset-4 hover:underline"
          >
            View contracts
          </Link>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Info
            label="Current salary"
            value={
              profile.salary !== null ? (
                <MoneyDisplay amount={profile.salary} />
              ) : (
                "—"
              )
            }
          />
          <Info
            label="Years remaining"
            value={`${profile.yearsRemaining} (${profile.startYear}–${profile.endYear})`}
          />
          <Info label="Status" value={<StatusBadge label={profile.status} />} />
          <Info
            label="Remaining value"
            value={<MoneyDisplay amount={profile.totalRemainingValue} />}
          />
          <Info
            label="% of team payroll"
            value={
              profile.payrollPercent !== null
                ? `${profile.payrollPercent}%`
                : "—"
            }
          />
          <Info
            label="Team payroll"
            value={
              profile.teamPayroll !== null ? (
                <MoneyDisplay amount={profile.teamPayroll} />
              ) : (
                "—"
              )
            }
          />
          <Info
            label="Team option"
            value={profile.hasPendingTeamOption ? "Pending" : "None"}
          />
          <Info
            label="Player option"
            value={profile.hasPendingPlayerOption ? "Pending" : "None"}
          />
        </div>
      </Section>

      <Section title="Salary schedule">
        {profile.salaryByYear.length === 0 ? (
          <EmptyState message="No salary-by-year entries." />
        ) : (
          <CardTable headers={["Year", "Salary"]}>
            {profile.salaryByYear.map((entry) => (
              <tr key={entry.year} className="border-t border-zinc-800">
                <td className="px-3 py-2 text-zinc-100">{entry.year}</td>
                <td className="px-3 py-2">
                  <MoneyDisplay amount={entry.salary} />
                </td>
              </tr>
            ))}
          </CardTable>
        )}
      </Section>
    </div>
  );
}

function Info(props: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-surface-line border-b-team-ink bg-surface-deep/80 p-3">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-zinc-400">
        {props.label}
      </p>
      <div className="mt-1 text-sm text-zinc-100">{props.value}</div>
    </div>
  );
}
