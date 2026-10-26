import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadSettingsView } from "@/application/game-service";
import { AiDelegationForm } from "@/components/settings/AiDelegationForm";
import { SettingsPageShell } from "@/components/settings/SettingsPageShell";
import { settingsTabPath } from "@/components/settings/SettingsSubNav";
import { Section } from "@/components/ui/Section";

export const metadata: Metadata = { title: "Settings" };

type SettingsAiPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

/** AI Management tab: per-franchise delegation (open to every member). */
export default async function SettingsAiPage({
  params,
  searchParams,
}: SettingsAiPageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadSettingsView(saveId);
  if (!view) {
    notFound();
  }

  return (
    <SettingsPageShell saveId={saveId} active="ai" error={error}>
      <Section title="AI Team Management">
        <p className="text-sm text-muted">
          Applies to {view.controlledTeamLabel}. Each franchise you control has
          its own delegation.
        </p>
        <AiDelegationForm
          // Remount when the saved delegation changes (after a save).
          key={JSON.stringify(view.aiAssistance)}
          saveId={saveId}
          returnPath={settingsTabPath(saveId, "ai")}
          initial={view.aiAssistance}
        />
      </Section>
    </SettingsPageShell>
  );
}
