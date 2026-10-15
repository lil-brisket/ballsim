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
  leaveOnlineLeagueAction,
  removeOnlineParticipantAction,
  revokeLeagueInviteAction,
  transferOnlineHostAction,
} from "@/application/actions/online-league";
import { InviteCreator } from "@/components/game/InviteCreator";
import { ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { StatusBadge } from "@/components/owner/StatusBadge";
import { cn, focusRingClass, touchTargetClass } from "@/components/ui/styles";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

const buttonClass = cn(
  touchTargetClass,
  "cursor-pointer rounded-lg border border-surface-line bg-surface-deep/60 px-3 text-sm text-zinc-200 hover:border-team-ink hover:text-team-ink",
  focusRingClass,
);

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
      <summary className={cn(buttonClass, "list-none")}>{props.label}</summary>
      <form
        action={props.action}
        className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-700/60 bg-amber-950/30 p-2 text-sm text-amber-100"
      >
        <input type="hidden" name="saveId" value={props.saveId} />
        {Object.entries(props.fields ?? {}).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <span>{props.warning}</span>
        <button type="submit" className={buttonClass}>
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
      <PageHeader
        title="League Members"
        subtitle="Players in this online league"
      />
      {error ? <ErrorState message={error} /> : null}

      <Section title="Players">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-200">
            <thead className="text-xs uppercase text-zinc-400">
              <tr>
                <th className="py-2 pr-4">Player</th>
                <th className="py-2 pr-4">Teams</th>
                <th className="py-2 pr-4">Status</th>
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
                        <StatusBadge label="Host" tone="info" />
                      </span>
                    ) : null}
                    {p.isActive ? (
                      <span className="ml-2 text-xs text-zinc-400">(You)</span>
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
                    {p.isReady ? "✓ ready" : "waiting"}
                  </td>
                  {isHost ? (
                    <td className="py-2 align-top">
                      {p.isActive ? null : (
                        <div className="flex flex-wrap gap-2">
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
              <p className="text-sm text-zinc-400">No invites yet.</p>
            ) : (
              <ul className="space-y-2">
                {invites.map((invite) => (
                  <li
                    key={invite.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-surface-line px-3 py-2 text-sm text-zinc-200"
                  >
                    <span>{inviteStatus(invite, now)}</span>
                    <span className="text-xs text-zinc-400">
                      {invite.uses}/{invite.maxUses} uses · created{" "}
                      {invite.createdOn} · expires{" "}
                      {invite.expiresAt.toISOString().slice(0, 10)}
                    </span>
                    {invite.usable ? (
                      <form action={revokeLeagueInviteAction}>
                        <input type="hidden" name="saveId" value={saveId} />
                        <input
                          type="hidden"
                          name="inviteId"
                          value={invite.id}
                        />
                        <button type="submit" className={buttonClass}>
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
