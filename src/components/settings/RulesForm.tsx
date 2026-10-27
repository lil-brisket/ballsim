"use client";

import { useState, useTransition } from "react";
import { updateLeagueSettingsAction } from "@/application/actions";
import { buttonClass } from "@/components/ui/Button";
import {
  FieldGrid,
  InjuryFrequencyField,
  MoneyInputField,
  SetupSection,
  ToggleField,
} from "@/components/owner/game-setup/fields";
import type { InjuryFrequency } from "@/domain/game-settings";
import {
  DEFAULT_SALARY_CAP,
  MAX_SALARY_CAP,
  MIN_SALARY_CAP,
} from "@/systems/salary-cap-config";
import {
  DEFAULT_STAFF_BUDGET,
  MAX_STAFF_BUDGET,
  MIN_STAFF_BUDGET,
} from "@/systems/staff-budget-config";
import type { LeagueSettingsChanges } from "@/systems/league-settings-edit";

export type RulesFormValues = {
  injuryFrequency: InjuryFrequency;
  salaryCapEnabled: boolean;
  salaryCap: number;
  staffBudget: number;
  luxuryTaxEnabled: boolean;
  salaryFloorEnabled: boolean;
  veteranRightsEnabled: boolean;
  revenueSharingEnabled: boolean;
  draftLotteryEnabled: boolean;
  restrictedFreeAgency: boolean;
};

const FINANCIAL_KEYS = [
  "salaryCapEnabled",
  "salaryCap",
  "staffBudget",
  "luxuryTaxEnabled",
  "salaryFloorEnabled",
  "veteranRightsEnabled",
  "revenueSharingEnabled",
] as const;

/** Only the rules that differ from `initial`; never the season format. */
export function diffRules(
  initial: RulesFormValues,
  values: RulesFormValues,
): LeagueSettingsChanges {
  const changes: LeagueSettingsChanges = {};
  if (values.injuryFrequency !== initial.injuryFrequency) {
    changes.injuryFrequency = values.injuryFrequency;
  }
  const financialRules: Record<string, boolean | number> = {};
  for (const key of FINANCIAL_KEYS) {
    if (values[key] !== initial[key]) {
      financialRules[key] = values[key];
    }
  }
  if (Object.keys(financialRules).length > 0) {
    changes.financialRules =
      financialRules as LeagueSettingsChanges["financialRules"];
  }
  if (values.draftLotteryEnabled !== initial.draftLotteryEnabled) {
    changes.draftLotteryEnabled = values.draftLotteryEnabled;
  }
  if (values.restrictedFreeAgency !== initial.restrictedFreeAgency) {
    changes.restrictedFreeAgency = values.restrictedFreeAgency;
  }
  return changes;
}

export function RulesForm(props: {
  saveId: string;
  returnPath: string;
  initial: RulesFormValues;
  /** Why restricted free agency cannot change right now; null when it can. */
  rfaLock: string | null;
  /** False for non-host members of an online league. */
  canEdit: boolean;
}) {
  const [values, setValues] = useState<RulesFormValues>(props.initial);
  const [pending, startTransition] = useTransition();
  const changes = diffRules(props.initial, values);
  const changed = Object.keys(changes).length > 0;

  function set<K extends keyof RulesFormValues>(
    key: K,
    value: RulesFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      className="space-y-6"
      action={(formData) => {
        startTransition(() => {
          void updateLeagueSettingsAction(formData);
        });
      }}
    >
      <input type="hidden" name="saveId" value={props.saveId} />
      <input type="hidden" name="returnPath" value={props.returnPath} />
      <input type="hidden" name="changesJson" value={JSON.stringify(changes)} />
      <fieldset
        disabled={!props.canEdit}
        className="m-0 min-w-0 space-y-6 border-0 p-0"
      >
        <SetupSection id="rules-injuries" title="Injuries">
          <FieldGrid>
            <InjuryFrequencyField
              value={values.injuryFrequency}
              onChange={(value) => set("injuryFrequency", value)}
            />
          </FieldGrid>
        </SetupSection>

        <SetupSection id="rules-financial" title="Financial rules">
          <FieldGrid>
            <ToggleField
              label="Player Salary Cap enabled"
              checked={values.salaryCapEnabled}
              onChange={(checked) => set("salaryCapEnabled", checked)}
            />
            <MoneyInputField
              label="Player Salary Cap"
              value={values.salaryCap}
              min={MIN_SALARY_CAP}
              max={MAX_SALARY_CAP}
              defaultValue={DEFAULT_SALARY_CAP}
              disabled={!values.salaryCapEnabled}
              onChange={(salaryCap) => set("salaryCap", salaryCap)}
            />
            <MoneyInputField
              label="Staff Budget"
              value={values.staffBudget}
              min={MIN_STAFF_BUDGET}
              max={MAX_STAFF_BUDGET}
              defaultValue={DEFAULT_STAFF_BUDGET}
              onChange={(staffBudget) => set("staffBudget", staffBudget)}
            />
            <ToggleField
              label="Luxury tax"
              checked={values.luxuryTaxEnabled}
              onChange={(checked) => set("luxuryTaxEnabled", checked)}
            />
            <ToggleField
              label="Salary floor"
              checked={values.salaryFloorEnabled}
              onChange={(checked) => set("salaryFloorEnabled", checked)}
            />
            <ToggleField
              label="Veteran rights"
              checked={values.veteranRightsEnabled}
              onChange={(checked) => set("veteranRightsEnabled", checked)}
            />
            <ToggleField
              label="Revenue sharing"
              checked={values.revenueSharingEnabled}
              onChange={(checked) => set("revenueSharingEnabled", checked)}
            />
          </FieldGrid>
        </SetupSection>

        <SetupSection id="rules-draft" title="Draft and free agency">
          <FieldGrid>
            <ToggleField
              label="Draft lottery"
              checked={values.draftLotteryEnabled}
              onChange={(checked) => set("draftLotteryEnabled", checked)}
            />
            <ToggleField
              label="Restricted free agency"
              checked={values.restrictedFreeAgency}
              disabled={props.rfaLock !== null}
              note={props.rfaLock ?? undefined}
              onChange={(checked) => set("restrictedFreeAgency", checked)}
            />
          </FieldGrid>
        </SetupSection>
      </fieldset>

      <div className="space-y-2">
        <p className="text-sm text-faint">
          Changes apply the next time the simulation uses each rule.
        </p>
        <button
          type="submit"
          disabled={!props.canEdit || pending || !changed}
          className={buttonClass({ variant: "primary" })}
        >
          {pending ? "Saving…" : "Save rules"}
        </button>
      </div>
    </form>
  );
}
