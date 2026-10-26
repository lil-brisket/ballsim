import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadSettingsView } from "@/application/game-service";
import { SettingRow } from "@/components/settings/SettingRow";
import { Section } from "@/components/ui/Section";
import { RulesForm } from "@/components/settings/RulesForm";
import {
  HostOnlyNotice,
  SettingsPageShell,
} from "@/components/settings/SettingsPageShell";
import { settingsTabPath } from "@/components/settings/SettingsSubNav";

export const metadata: Metadata = { title: "Settings" };

type SettingsRulesPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

/** Rules tab: injuries, financial rules, draft and free agency. */
export default async function SettingsRulesPage({
  params,
  searchParams,
}: SettingsRulesPageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadSettingsView(saveId);
  if (!view) {
    notFound();
  }
  const { financialRules } = view.settings;

  return (
    <SettingsPageShell saveId={saveId} active="rules" error={error}>
      {view.canEditLeague ? null : (
        <div className="mb-4">
          <HostOnlyNotice>
            Only the league host can change league settings.
          </HostOnlyNotice>
        </div>
      )}
      <RulesForm
        saveId={saveId}
        returnPath={settingsTabPath(saveId, "rules")}
        canEdit={view.canEditLeague}
        rfaLock={view.rfaLock}
        initial={{
          injuryFrequency: view.settings.injuryFrequency,
          salaryCapEnabled: financialRules.salaryCapEnabled,
          salaryCap: financialRules.salaryCap,
          staffBudget: financialRules.staffBudget,
          luxuryTaxEnabled: financialRules.luxuryTaxEnabled,
          salaryFloorEnabled: financialRules.salaryFloorEnabled,
          veteranRightsEnabled: financialRules.veteranRightsEnabled,
          revenueSharingEnabled: financialRules.revenueSharingEnabled,
          draftLotteryEnabled: view.settings.draftLottery.enabled,
          restrictedFreeAgency: view.settings.offseason.restrictedFreeAgency,
        }}
      />

      <Section title="Current rule details" className="mt-6">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <SettingRow
            label="Luxury tax line"
            value={`${financialRules.luxuryTaxThresholdPercent}% over the cap`}
          />
          <SettingRow
            label="Salary floor"
            value={`${financialRules.salaryFloorPercent}% of the cap`}
          />
          <SettingRow
            label="Veteran rights"
            value={`After ${financialRules.veteranRightsSeasons} seasons`}
          />
          <SettingRow
            label="Draft lottery"
            value={`Top ${view.settings.draftLottery.picksDrawn} picks drawn`}
          />
        </dl>
      </Section>
    </SettingsPageShell>
  );
}
