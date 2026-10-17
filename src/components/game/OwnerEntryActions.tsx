import { buttonClass } from "@/components/ui/Button";
import Link from "next/link";
import { openSaveAction } from "@/application/actions";
import type { ValidOwnerSavePreview } from "@/application/save-preview-helpers";
import { ErrorState } from "@/components/ui/EmptyState";
import { ScoreNumeral } from "@/components/ui/ScoreNumeral";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { TeamThemeScope } from "@/components/ui/TeamThemeScope";

const panelClass = "arena-panel flex flex-col gap-3 p-6";

export function OwnerEntryActions(props: {
  continueSave: ValidOwnerSavePreview | null;
  hasAnySaves: boolean;
  atSaveLimit: boolean;
  maxSaveSlots: number;
  newGameHref: string;
}) {
  const { continueSave, hasAnySaves, atSaveLimit, maxSaveSlots, newGameHref } =
    props;

  return (
    <>
      {!continueSave ? (
        <section
          className={`${panelClass} border-team-ink/40`}
          aria-label="No Owner saves"
        >
          <h2 className="text-lg font-medium text-zinc-50">
            No Owner saves yet
          </h2>
          <p className="text-sm text-zinc-300">
            Start your first franchise to begin.
          </p>
          {atSaveLimit ? (
            <ErrorState
              message={`At most ${maxSaveSlots} saves are allowed. Delete a save to create another.`}
            />
          ) : (
            <Link
              href={newGameHref}
              className={`mt-2 w-fit ${buttonClass({ variant: "secondary", size: "lg" })}`}
            >
              Start New Game →
            </Link>
          )}
        </section>
      ) : null}

      <section className="grid gap-4" aria-label="Owner entry actions">
        {continueSave ? (
          <TeamThemeScope branding={continueSave.controlledTeam.branding}>
            <form
              action={openSaveAction}
              className={`${panelClass} border-team-ink/60 shadow-team-glow`}
            >
              <input type="hidden" name="saveId" value={continueSave.id} />
              <div className="flex items-center gap-4">
                <TeamBadge
                  branding={continueSave.controlledTeam.branding}
                  name={`${continueSave.controlledTeam.city} ${continueSave.controlledTeam.name}`}
                  size="xl"
                  decorative
                />
                <div className="min-w-0 space-y-1">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-team-ink">
                    Continue
                  </p>
                  <h2 className="font-display text-3xl font-extrabold uppercase leading-none tracking-wide text-zinc-50">
                    {continueSave.controlledTeam.city}{" "}
                    {continueSave.controlledTeam.name}
                  </h2>
                  <p className="text-sm text-zinc-300">{continueSave.name}</p>
                  <p className="font-mono text-xs text-zinc-300">
                    Season {continueSave.seasonYear} ·{" "}
                    {continueSave.currentDate} · {continueSave.seasonPhase}
                  </p>
                </div>
                {continueSave.record ? (
                  <ScoreNumeral
                    value={`${continueSave.record.wins}–${continueSave.record.losses}`}
                    label="Record"
                    labelBelow
                    size="lg"
                    tone="team"
                    align="center"
                    className="ml-auto hidden sm:flex"
                  />
                ) : null}
              </div>
              <button
                type="submit"
                className={`mt-auto w-fit ${buttonClass({ variant: "primary", size: "lg" })}`}
              >
                Continue →
              </button>
            </form>
          </TeamThemeScope>
        ) : null}

        <div className={panelClass}>
          <div className="space-y-1">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-400">
              Load Another Save
            </p>
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-zinc-50">
              Choose an existing Owner save
            </h2>
            <p className="text-sm text-zinc-300">
              {hasAnySaves
                ? "Open a different franchise or manage save slots."
                : "No Owner saves to load yet."}
            </p>
          </div>
          {hasAnySaves ? (
            <Link
              href="/saves?mode=owner"
              className={`mt-auto w-fit ${buttonClass({ variant: "secondary", size: "lg" })}`}
            >
              Load Save →
            </Link>
          ) : (
            <p className="mt-auto text-sm text-zinc-400">No saves available.</p>
          )}
        </div>

        {continueSave ? (
          <div className={panelClass}>
            <div className="space-y-1">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-400">
                Start New Game
              </p>
              <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-zinc-50">
                Create a new franchise
              </h2>
              <p className="text-sm text-zinc-300">
                Configure league rules and begin a new Owner Mode career.
              </p>
            </div>
            {atSaveLimit ? (
              <div className="mt-auto space-y-3">
                <ErrorState
                  message={`At most ${maxSaveSlots} saves are allowed. Delete a save to create another.`}
                />
                <Link
                  href="/saves?mode=owner"
                  className={`w-fit ${buttonClass({ variant: "secondary", size: "lg" })}`}
                >
                  Manage Saves →
                </Link>
              </div>
            ) : (
              <Link
                href={newGameHref}
                className={`mt-auto w-fit ${buttonClass({ variant: "secondary", size: "lg" })}`}
              >
                New Game →
              </Link>
            )}
          </div>
        ) : null}
      </section>
    </>
  );
}
