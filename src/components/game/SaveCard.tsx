import { buttonClass } from "@/components/ui/Button";
import { deleteSaveAction, openSaveAction } from "@/application/actions";
import { getGameModeDefinition } from "@/application/game-mode-catalog";
import type { OwnerSavePreview } from "@/application/game-service";
import { ConfirmDialog } from "@/components/owner/ConfirmDialog";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ArenaPanel } from "@/components/ui/ArenaPanel";
import { ScoreNumeral } from "@/components/ui/ScoreNumeral";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { TeamThemeScope } from "@/components/ui/TeamThemeScope";

function formatLastPlayed(date: Date): string {
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function DeleteSave(props: { id: string; name: string }) {
  return (
    <ConfirmDialog
      title="Delete save?"
      description={`Delete “${props.name}”? This cannot be undone.`}
      confirmLabel="Delete"
    >
      <form action={deleteSaveAction}>
        <input type="hidden" name="saveId" value={props.id} />
        <button type="submit" className={buttonClass({ variant: "danger" })}>
          Confirm delete
        </button>
      </form>
    </ConfirmDialog>
  );
}

/**
 * One save as a team-themed card: badge, team and save name, record, season
 * line and last-played time. Unloadable saves keep a plain error card.
 */
export function SaveCard(props: {
  preview: OwnerSavePreview;
  showDelete?: boolean;
}) {
  const { preview, showDelete = true } = props;

  if (!preview.ok) {
    return (
      <li className="flex flex-col gap-3 rounded-xl border border-rose-900/50 bg-rose-950/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-zinc-100">{preview.name}</p>
          <p className="mt-1 text-sm text-rose-300" role="status">
            {preview.error}
          </p>
          <p className="mt-1 font-mono text-xs text-zinc-400">
            Last updated {formatLastPlayed(preview.updatedAt)}
          </p>
        </div>
        {showDelete ? <DeleteSave id={preview.id} name={preview.name} /> : null}
      </li>
    );
  }

  const modeDef = getGameModeDefinition(preview.mode);
  const teamLabel = `${preview.controlledTeam.city} ${preview.controlledTeam.name}`;

  return (
    <li>
      <TeamThemeScope branding={preview.controlledTeam.branding}>
        <ArenaPanel
          as="div"
          edge="left"
          raised
          className="hover-lift flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-center gap-4">
            <TeamBadge
              branding={preview.controlledTeam.branding}
              name={teamLabel}
              size="lg"
              decorative
            />
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-2xl font-bold uppercase leading-tight tracking-wide text-zinc-50">
                  {preview.name}
                </p>
                <StatusBadge label={modeDef.name} tone="info" />
                {preview.participantCount != null ? (
                  <StatusBadge
                    label={`${
                      preview.participationMode === "online"
                        ? "Online"
                        : "Local shared"
                    } · ${preview.participantCount} players`}
                    tone="info"
                  />
                ) : null}
              </div>
              <p className="text-sm text-zinc-200">{teamLabel}</p>
              <p className="font-mono text-xs text-zinc-300">
                Season {preview.seasonYear} · {preview.currentDate} ·{" "}
                {preview.seasonPhase}
              </p>
              <p className="text-xs text-zinc-400">
                Last played {formatLastPlayed(preview.updatedAt)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-4">
            {preview.record ? (
              <ScoreNumeral
                value={`${preview.record.wins}–${preview.record.losses}`}
                label="Record"
                labelBelow
                size="md"
                tone="team"
                align="center"
              />
            ) : null}
            <form action={openSaveAction}>
              <input type="hidden" name="saveId" value={preview.id} />
              <button
                type="submit"
                className={buttonClass({ variant: "primary" })}
              >
                Open
              </button>
            </form>
            {showDelete ? (
              <DeleteSave id={preview.id} name={preview.name} />
            ) : null}
          </div>
        </ArenaPanel>
      </TeamThemeScope>
    </li>
  );
}
