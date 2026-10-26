import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSettingsView } from "@/application/game-service";
import { ExportPanel } from "@/components/settings/ExportPanel";
import { RosterEditorForm } from "@/components/settings/RosterEditorForm";
import { RosterPicker } from "@/components/settings/RosterPicker";
import { SettingsPageShell } from "@/components/settings/SettingsPageShell";
import { settingsTabPath } from "@/components/settings/SettingsSubNav";
import { Section } from "@/components/ui/Section";
import { linkClass } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Settings" };

type SettingsToolsPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{
    error?: string;
    team?: string | string[];
    player?: string | string[];
  }>;
};

function single(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return first === undefined || first === "" ? undefined : first;
}

/** Tools tab: roster editor, exports and draft class import pointer. */
export default async function SettingsToolsPage({
  params,
  searchParams,
}: SettingsToolsPageProps) {
  const { saveId } = await params;
  const query = await searchParams;
  const view = await loadSettingsView(saveId, {
    teamId: single(query.team),
    playerId: single(query.player),
  });
  if (!view) {
    notFound();
  }

  const basePath = settingsTabPath(saveId, "tools");
  const search = new URLSearchParams();
  if (view.selectedTeamId) search.set("team", view.selectedTeamId);
  if (view.selectedPlayer) search.set("player", view.selectedPlayer.id);
  const returnPath = search.size > 0 ? `${basePath}?${search}` : basePath;

  return (
    <SettingsPageShell saveId={saveId} active="tools" error={query.error}>
      <Section title="Roster editor">
        {view.canEditLeague ? (
          <>
            <p className="text-sm text-muted">
              Edit a player&apos;s name, age, potential and attributes. Ratings
              run from 1 to 99.
            </p>
            <RosterPicker
              teams={view.teams}
              selectedTeamId={view.selectedTeamId}
              players={view.teamPlayers}
              selectedPlayerId={view.selectedPlayer?.id ?? null}
            />
            {view.selectedPlayer ? (
              <RosterEditorForm
                key={view.selectedPlayer.id}
                saveId={saveId}
                returnPath={returnPath}
                player={view.selectedPlayer}
              />
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted">
            Only the league host can edit rosters.
          </p>
        )}
      </Section>

      <Section title="Export">
        <ExportPanel saveId={saveId} draftYears={view.draftYears} />
      </Section>

      <Section title="Draft class import">
        <p className="text-sm text-muted">
          Custom draft classes are imported on the{" "}
          <Link href={`/dashboard/${saveId}/draft`} className={linkClass}>
            Draft page
          </Link>{" "}
          when the league prepares each year&apos;s class.
        </p>
      </Section>
    </SettingsPageShell>
  );
}
