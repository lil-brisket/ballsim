import { formatMoney, MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { Section } from "@/components/ui/Section";
import type { PayrollRulesView } from "@/state/payroll-rules-selectors";

function lastAssessmentParts(
  last: NonNullable<PayrollRulesView["lastAssessment"]>,
): string[] {
  const parts: string[] = [];
  if (last.taxBill > 0) {
    parts.push(`paid ${formatMoney(last.taxBill)} tax`);
  }
  if (last.taxShare > 0) {
    parts.push(`received ${formatMoney(last.taxShare)} from the tax pool`);
  }
  if (last.floorShortfall > 0) {
    parts.push(`paid ${formatMoney(last.floorShortfall)} under the floor`);
  }
  return parts;
}

/**
 * One-line tax-line note for the contracts and free agency headers.
 * Renders nothing when the luxury tax is off.
 */
export function TaxLineNote(props: {
  rules: PayrollRulesView;
  className?: string;
}) {
  const { rules } = props;
  if (!rules.luxuryTaxEnabled || rules.threshold === null) {
    return null;
  }
  const room = rules.threshold - rules.payroll;
  return (
    <p className={props.className ?? "text-sm text-zinc-400"}>
      {room >= 0 ? (
        <>
          Tax line {formatMoney(rules.threshold)}: {formatMoney(room)} below
        </>
      ) : (
        <>
          Tax line {formatMoney(rules.threshold)}:{" "}
          <span className="text-red-400">{formatMoney(-room)} over</span> —
          projected tax {formatMoney(rules.projectedTax)}
        </>
      )}
    </p>
  );
}

/** Finances "Payroll rules" section. Hidden when both tax and floor are off. */
export function PayrollRulesPanel(props: { rules: PayrollRulesView }) {
  const { rules } = props;
  const taxOn = rules.luxuryTaxEnabled && rules.threshold !== null;
  const floorOn = rules.salaryFloorEnabled && rules.floor !== null;
  if (!taxOn && !floorOn) {
    return null;
  }
  const last = rules.lastAssessment;
  const lastParts = last ? lastAssessmentParts(last) : [];

  return (
    <Section title="Payroll rules">
      <ul className="space-y-1.5 text-sm text-zinc-300">
        {rules.projectsNextSeason ? (
          <li className="flex justify-between gap-4">
            <span>Payroll for {rules.seasonYear}</span>
            <MoneyDisplay amount={rules.payroll} />
          </li>
        ) : null}
        {taxOn && rules.threshold !== null ? (
          <li className="flex justify-between gap-4">
            <span>Tax line</span>
            <span>
              <MoneyDisplay amount={rules.threshold} />
              {" · "}
              {rules.payroll > rules.threshold ? (
                <span className="text-red-400">
                  {formatMoney(rules.payroll - rules.threshold)} over
                </span>
              ) : (
                `${formatMoney(rules.threshold - rules.payroll)} under`
              )}
            </span>
          </li>
        ) : null}
        {taxOn && rules.projectedTax > 0 ? (
          <li className="flex justify-between gap-4">
            <span>Projected tax</span>
            <MoneyDisplay amount={rules.projectedTax} />
          </li>
        ) : null}
        {floorOn && rules.floor !== null ? (
          <li className="flex justify-between gap-4">
            <span>Salary floor</span>
            <MoneyDisplay amount={rules.floor} />
          </li>
        ) : null}
        {floorOn && rules.projectedFloorShortfall > 0 ? (
          <li className="flex justify-between gap-4">
            <span>Projected floor charge</span>
            <MoneyDisplay amount={rules.projectedFloorShortfall} />
          </li>
        ) : null}
      </ul>
      {last ? (
        <p className="mt-2 text-sm text-zinc-500">
          {last.seasonYear}:{" "}
          {lastParts.length > 0
            ? lastParts.join(" / ")
            : "No tax or floor charge."}
        </p>
      ) : null}
    </Section>
  );
}
