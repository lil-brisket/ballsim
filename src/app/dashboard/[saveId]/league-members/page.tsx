import type { Metadata } from "next";
import { formatGameDate } from "@/presentation/game-date";
import { buttonClass as buttonClassFn } from "@/components/ui/Button";
import { notFound } from "next/navigation";
import { loadOwnerSaveView } from "@/application/game-service";
import {
  INVITE_DEFAULT_DAYS,
  INVITE_MAX_DAYS,
  INVITE_MAX_USES,
  listLeagueInvites,
  type InviteView,
} from "@/application/game-service/online-league";
import { onlineLeagueContext } from "@/application/online/context";
import {
  cancelApprovalWindowAction,
  leaveOnlineLeagueAction,
  openApprovalWindowAction,
  removeOnlineParticipantAction,
  revokeLeagueInviteAction,
  setAutoManageAfterDaysAction,
  setParticipantAutoManagedAction,
  transferOnlineHostAction,
} from "@/application/actions/online-league";
import {
  APPROVAL_WINDOW_HOURS_OPTIONS,
  AUTO_MANAGE_AFTER_DAYS_OPTIONS,
} from "@/domain/participation";
import { InviteCreator } from "@/components/game/InviteCreator";
import { ErrorState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/components/ui/styles";

export const metadata: Metadata = { title: "League Members" };

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

const memberButtonClass = cn(
  "cursor-pointer",
  buttonClassFn({ variant: "secondary" }),
);

function hoursLabel(hours: number): string {
  if (hours < 24) return hours === 1 ? "1 hour" : `${hours} hours`;
  if (hours === 168) return "1 week";
  const days = hours / 24;
  return days === 1 ? "1 day" : `${days} days`;
}

function idleLabel(days: number): string {
  return `After ${days} day${days === 1 ? "" : "s"} idle`;
}

const AUTO_REASON_LABEL = {
  missed_approval: "missed approval",
  inactive: "inactive",
  manual: "away mode",
} as const;

function formatDateTime(iso: string) {
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })}
    </time>
  );
}

function inviteStatus(invite: InviteView, now: Date): string {
  if (invite.revoked) return "Revoked";
  if (invite.expiresAt <= now) return "Expired";
  if (invite.uses >= invite.maxUses) return "Used up";
  return invite.usable ? "Usable" : "Unavailable";
}

/** Inline confirm without client JS: a disclosure that holds the real form. */
function ConfirmForm(props: {
  action: (formData: FormData) => Promise<void>;
  saveId: string;
  fields?: Record<string, string>;
  label: string;
  warning: string;
  confirmLabel: string;
}) {
  return (
    <details className="inline-block align-top">
      <summary className={cn(memberButtonClass, "list-none")}>
        {props.label}
      </summary>
      <form
        action={props.action}
        className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-team-ink/50 bg-team/15 p-2 text-sm text-ink"
      >
        <input type="hidden" name="saveId" value={props.saveId} />
        {Object.entries(props.fields ?? {}).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <span>{props.warning}</span>
        <button type="submit" className={memberButtonClass}>
          {props.confirmLabel}
        </button>
      </form>
    </details>
  );
}

export default async function LeagueMembersPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  const participation = view?.dashboard.participation;
  if (!view || !participation || participation.mode !== "online") {
    notFound();
  }

  const teamNames = new Map(
    view.teams.map((t) => [t.id as string, `${t.city} ${t.name}`]),
  );
  const me = participation.participants.find((p) => p.isActive);
  const isHost = me?.isHost ?? false;
  const approvalWindow = participation.approvalWindow;

  let invites: InviteView[] = [];
  let inviteError: string | null = null;
  if (isHost) {
    const result = await listLeagueInvites(await onlineLeagueContext(), saveId);
    if (result.ok) {
      invites = result.invites;
    } else {
      inviteError = result.error;
    }
  }
  const now = new Date();

  return (
    <>
      <PageHeader title="League Members" />
      {error ? <ErrorState message={error} /> : null}

      <Section title="Players">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-ink">
            <thead className="text-sm text-muted">
              <tr>
                <th className="py-2 pr-4">Player</th>
                <th className="py-2 pr-4">Teams</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Last active</th>
                {isHost ? <th className="py-2">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {participation.participants.map((p) => (
                <tr key={p.id} className="border-t border-surface-line">
                  <td className="py-2 pr-4 align-top">
                    <span className="font-medium">{p.displayName}</span>
                    {p.isHost ? (
                      <span className="ml-2">
                        <StatusBadge label="Commissioner" tone="info" />
                      </span>
                    ) : null}
                    {p.isActive ? (
                      <span className="ml-2 text-sm text-muted">(You)</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-4 align-top">
                    {p.teamIds.length > 0
                      ? p.teamIds
                          .map((id) => teamNames.get(id) ?? id)
                          .join(", ")
                      : "—"}
                  </td>
                  <td className="py-2 pr-4 align-top">
                    {p.autoManaged
                      ? `AI-managed (${AUTO_REASON_LABEL[p.autoManaged.reason]})`
                      : p.isReady
                        ? "✓ ready"
                        : "waiting"}
                  </td>
                  <td className="py-2 pr-4 align-top">
                    {p.lastActiveAt ? formatDateTime(p.lastActiveAt) : "—"}
                  </td>
                  {isHost ? (
                    <td className="py-2 align-top">
                      {p.isActive ? null : (
                        <div className="flex flex-wrap gap-2">
                          {p.autoManaged ? (
                            <form action={setParticipantAutoManagedAction}>
                              <input
                                type="hidden"
                                name="saveId"
                                value={saveId}
                              />
                              <input
                                type="hidden"
                                name="participantId"
                                value={p.id}
                              />
                              <input
                                type="hidden"
                                name="autoManaged"
                                value="false"
                              />
                              <button
                                type="submit"
                                className={memberButtonClass}
                              >
                                Return control
                              </button>
                            </form>
                          ) : (
                            <ConfirmForm
                              action={setParticipantAutoManagedAction}
                              saveId={saveId}
                              fields={{
                                participantId: p.id,
                                autoManaged: "true",
                              }}
                              label="Auto-manage"
                              warning={`Let the AI manage ${p.displayName}'s teams until they take back control?`}
                              confirmLabel="Confirm auto-manage"
                            />
                          )}
                          <ConfirmForm
                            action={transferOnlineHostAction}
                            saveId={saveId}
                            fields={{ participantId: p.id }}
                            label="Make host"
                            warning={`Make ${p.displayName} the host?`}
                            confirmLabel="Confirm make host"
                          />
                          <ConfirmForm
                            action={removeOnlineParticipantAction}
                            saveId={saveId}
                            fields={{ participantId: p.id }}
                            label="Remove"
                            warning={`Remove ${p.displayName}? Their franchises return to AI control.`}
                            confirmLabel="Confirm remove"
                          />
                        </div>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Advance approvals">
        {isHost ? (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Open an approval window to give members time to press Approve
              advance. Once everyone has approved or the window closes, you can
              advance, and members who did not approve are AI-managed until they
              take back control. Idle members can also be AI-managed
              automatically.
            </p>
            <form
              action={openApprovalWindowAction}
              className="flex flex-wrap items-end gap-2"
            >
              <input type="hidden" name="saveId" value={saveId} />
              <label className="flex flex-col gap-1 text-sm text-soft">
                Approval window length
                <Select
                  name="hours"
                  defaultValue={String(APPROVAL_WINDOW_HOURS_OPTIONS[3])}
                >
                  {APPROVAL_WINDOW_HOURS_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      {hoursLabel(h)}
                    </option>
                  ))}
                </Select>
              </label>
              <button type="submit" className={memberButtonClass}>
                Open approval window
              </button>
            </form>
            {approvalWindow ? (
              <div className="flex flex-wrap items-center gap-3 text-sm text-ink">
                <span>
                  {approvalWindow.closed ? (
                    <>
                      Approval window closed{" "}
                      {formatDateTime(approvalWindow.closesAt)}.
                    </>
                  ) : (
                    <>
                      Approval window closes{" "}
                      {formatDateTime(approvalWindow.closesAt)}.
                    </>
                  )}
                </span>
                <form action={cancelApprovalWindowAction}>
                  <input type="hidden" name="saveId" value={saveId} />
                  <button type="submit" className={memberButtonClass}>
                    Cancel window
                  </button>
                </form>
              </div>
            ) : null}
            <form
              action={setAutoManageAfterDaysAction}
              className="flex flex-wrap items-end gap-2"
            >
              <input type="hidden" name="saveId" value={saveId} />
              <label className="flex flex-col gap-1 text-sm text-soft">
                Auto-manage idle members
                <Select
                  name="days"
                  defaultValue={
                    participation.autoManageAfterDays == null
                      ? "off"
                      : String(participation.autoManageAfterDays)
                  }
                >
                  <option value="off">Off</option>
                  {AUTO_MANAGE_AFTER_DAYS_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {idleLabel(d)}
                    </option>
                  ))}
                </Select>
              </label>
              <button type="submit" className={memberButtonClass}>
                Save
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-1 text-sm text-muted">
            <p>
              {approvalWindow ? (
                approvalWindow.closed ? (
                  "The approval window has closed. The commissioner can advance; members who did not approve will be AI-managed."
                ) : (
                  <>
                    Approval window closes{" "}
                    {formatDateTime(approvalWindow.closesAt)}.
                  </>
                )
              ) : (
                "No approval window is open."
              )}
            </p>
            <p>
              {participation.autoManageAfterDays == null
                ? "Idle members are not auto-managed."
                : `Members idle for ${participation.autoManageAfterDays} day${
                    participation.autoManageAfterDays === 1 ? "" : "s"
                  } are AI-managed.`}
            </p>
          </div>
        )}
      </Section>

      {isHost ? (
        <Section title="Invites">
          <div className="space-y-4">
            <InviteCreator
              saveId={saveId}
              defaultDays={INVITE_DEFAULT_DAYS}
              maxDays={INVITE_MAX_DAYS}
              maxUses={INVITE_MAX_USES}
            />
            {inviteError ? <ErrorState message={inviteError} /> : null}
            {invites.length === 0 ? (
              <p className="text-sm text-muted">No invites yet.</p>
            ) : (
              <ul className="space-y-2">
                {invites.map((invite) => (
                  <li
                    key={invite.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-surface-line px-3 py-2 text-sm text-ink"
                  >
                    <span>{inviteStatus(invite, now)}</span>
                    <span className="text-sm text-muted">
                      {invite.uses}/{invite.maxUses} uses · created{" "}
                      {formatGameDate(invite.createdOn, { year: true })} ·
                      expires{" "}
                      {formatGameDate(invite.expiresAt.toISOString(), {
                        year: true,
                      })}
                    </span>
                    {invite.usable ? (
                      <form action={revokeLeagueInviteAction}>
                        <input type="hidden" name="saveId" value={saveId} />
                        <input
                          type="hidden"
                          name="inviteId"
                          value={invite.id}
                        />
                        <button type="submit" className={memberButtonClass}>
                          Revoke
                        </button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>
      ) : null}

      {!isHost && me ? (
        <Section title="Away mode">
          {me.autoManaged ? (
            <form action={setParticipantAutoManagedAction}>
              <input type="hidden" name="saveId" value={saveId} />
              <input type="hidden" name="participantId" value={me.id} />
              <input type="hidden" name="autoManaged" value="false" />
              <button type="submit" className={memberButtonClass}>
                Take back control
              </button>
            </form>
          ) : (
            <ConfirmForm
              action={setParticipantAutoManagedAction}
              saveId={saveId}
              fields={{ participantId: me.id, autoManaged: "true" }}
              label="Let the AI manage my teams"
              warning="Let the AI manage your teams until you take back control?"
              confirmLabel="Confirm away mode"
            />
          )}
        </Section>
      ) : null}

      {!isHost ? (
        <Section title="Leave league">
          <ConfirmForm
            action={leaveOnlineLeagueAction}
            saveId={saveId}
            label="Leave league"
            warning="Leave this league? Your franchises return to AI control."
            confirmLabel="Confirm leave"
          />
        </Section>
      ) : null}
    </>
  );
}
