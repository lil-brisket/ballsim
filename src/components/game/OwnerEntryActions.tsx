import { buttonClass } from "@/components/ui/Button";
import Link from "next/link";
import { openSaveAction } from "@/application/actions";
import type { ValidOwnerSavePreview } from "@/application/save-preview-helpers";
import { ErrorState } from "@/components/ui/EmptyState";
import { ScoreNumeral } from "@/components/ui/ScoreNumeral";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { formatGameDate } from "@/presentation/game-date";
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
          <SectionHeading title="No Owner saves yet" />
          <p className="text-sm text-soft">
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
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-team-ink">
                    Continue
                  </p>
                  <SectionHeading
                    as="h2"
                    size="display"
                    titleClassName="text-3xl font-extrabold leading-none text-ink"
                    title={`${continueSave.controlledTeam.city} ${continueSave.controlledTeam.name}`}
                  />
                  <p className="text-sm text-soft">{continueSave.name}</p>
                  <p className="text-sm text-soft">
                    Season {continueSave.seasonYear} ·{" "}
                    {formatGameDate(continueSave.currentDate, { year: true })} ·{" "}
                    {continueSave.seasonPhase}
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
            <SectionHeading
              eyebrow="Load Another Save"
              title="Choose an existing Owner save"
            />
            <p className="text-sm text-soft">
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
            <p className="mt-auto text-sm text-muted">No saves available.</p>
          )}
        </div>

        {continueSave ? (
          <div className={panelClass}>
            <div className="space-y-1">
              <SectionHeading
                eyebrow="Start New Game"
                title="Create a new franchise"
              />
              <p className="text-sm text-soft">
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
