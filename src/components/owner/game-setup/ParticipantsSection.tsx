import Link from "next/link";
import {
  MAX_LOCAL_PARTICIPANTS,
  MIN_LOCAL_PARTICIPANTS,
  PARTICIPANT_NAME_MAX_LENGTH,
  type LocalParticipantSetup,
  type ParticipationMode,
} from "@/domain/participation";
import {
  FieldGrid,
  SelectField,
  SetupSection,
  inputClass,
} from "@/components/owner/game-setup/fields";
import {
  RadioCardGroup,
  type RadioCardOption,
} from "@/components/owner/game-setup/RadioCardGroup";
import {
  SECTION_IDS,
  type ParticipationOptionId,
} from "@/components/owner/game-setup/game-setup-helpers";
import { ErrorList } from "@/components/owner/game-setup/setup-shared";
import { cn, linkClass } from "@/components/ui/styles";

type ParticipantsSectionProps = {
  participationMode: ParticipationMode;
  options: ReadonlyArray<RadioCardOption<ParticipationOptionId>>;
  signedInAs: string | null;
  online: boolean;
  localShared: boolean;
  participants: LocalParticipantSetup[];
  participantsTotal: number;
  maxControlled: number;
  participationErrors: readonly string[];
  onModeChange: (mode: ParticipationMode) => void;
  onParticipantCountChange: (count: number) => void;
  onParticipantChange: (
    index: number,
    patch: Partial<LocalParticipantSetup>,
  ) => void;
};

export function ParticipantsSection({
  participationMode,
  options,
  signedInAs,
  online,
  localShared,
  participants,
  participantsTotal,
  maxControlled,
  participationErrors,
  onModeChange,
  onParticipantCountChange,
  onParticipantChange: updateParticipant,
}: ParticipantsSectionProps) {
  return (
    <SetupSection
      id={SECTION_IDS.participants}
      title="League Participants"
      description="Choose who plays in this league."
    >
      <RadioCardGroup
        legend="League format"
        options={options}
        value={participationMode}
        onChange={onModeChange}
        columns={3}
      />
      {signedInAs === null ? (
        <p className="text-sm text-muted">
          <Link
            href="/login?next=/new/setup?mode=owner"
            className={cn(linkClass, "underline")}
          >
            Sign in to host an online league
          </Link>
        </p>
      ) : null}
      {online && signedInAs !== null ? (
        <p className="text-sm text-muted">
          Hosting as {signedInAs}. After you create the league and pick your
          franchises, invite players from League Members. Each player takes over
          one AI team when they join.
        </p>
      ) : null}
      {localShared ? (
        <div className="space-y-4">
          <div className="max-w-xs">
            <SelectField
              label="Number of players"
              value={participants.length}
              options={Array.from(
                {
                  length: MAX_LOCAL_PARTICIPANTS - MIN_LOCAL_PARTICIPANTS + 1,
                },
                (_, index) => {
                  const value = index + MIN_LOCAL_PARTICIPANTS;
                  return { value, label: String(value) };
                },
              )}
              onChange={onParticipantCountChange}
            />
          </div>
          <ul className="space-y-3">
            {participants.map((participant, index) => {
              const othersTotal = participantsTotal - participant.teamCount;
              const upper = Math.max(
                1,
                participant.teamCount,
                maxControlled - othersTotal,
              );
              return (
                <li key={index}>
                  <FieldGrid>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <label
                          className="block text-sm text-soft"
                          htmlFor={`participant-name-${index}`}
                        >
                          Player {index + 1} name
                        </label>
                        {index === 0 ? (
                          <span className="rounded bg-team/20 px-1.5 py-0.5 text-sm text-team-ink">
                            Host
                          </span>
                        ) : null}
                      </div>
                      <input
                        id={`participant-name-${index}`}
                        value={participant.displayName}
                        maxLength={PARTICIPANT_NAME_MAX_LENGTH}
                        onChange={(event) =>
                          updateParticipant(index, {
                            displayName: event.target.value,
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                    <SelectField
                      label={`Player ${index + 1} teams`}
                      value={participant.teamCount}
                      options={Array.from({ length: upper }, (_, i) => ({
                        value: i + 1,
                        label: String(i + 1),
                      }))}
                      onChange={(teamCount) =>
                        updateParticipant(index, { teamCount })
                      }
                    />
                  </FieldGrid>
                </li>
              );
            })}
          </ul>
          <p aria-live="polite" className="text-sm text-ink">
            {participantsTotal} of {maxControlled} franchises assigned
          </p>
          <p className="text-sm text-muted">
            Players take turns on this device. Each player presses Ready before
            the league advances. Teams nobody picks stay AI-controlled. After
            creating the league, each player&apos;s franchises are chosen on the
            Controlled Franchises step.
          </p>
          {participationErrors.length > 0 ? (
            <ErrorList errors={participationErrors} />
          ) : null}
        </div>
      ) : null}
    </SetupSection>
  );
}
