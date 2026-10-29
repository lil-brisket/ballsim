"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import {
  fantasyDraftPickAction,
  fetchFantasyDraftPlayerDetailAction,
} from "@/application/actions";
import { ControlledFranchisesPanel } from "@/components/fantasy-draft/ControlledFranchisesPanel";
import { DraftAutoPickControls } from "@/components/fantasy-draft/DraftAutoPickControls";
import { DraftConfirmDialog } from "@/components/fantasy-draft/DraftConfirmDialog";
import { DraftHeader } from "@/components/fantasy-draft/DraftHeader";
import { DraftHistoryPanel } from "@/components/fantasy-draft/DraftHistoryPanel";
import { DraftQueuePanel } from "@/components/fantasy-draft/DraftQueuePanel";
import { DraftSettingsPanel } from "@/components/fantasy-draft/DraftSettingsPanel";
import { FantasyDraftPlayerPanel } from "@/components/fantasy-draft/FantasyDraftPlayerPanel";
import { PlayerPoolTable } from "@/components/fantasy-draft/PlayerPoolTable";
import { RecommendationsPanel } from "@/components/fantasy-draft/RecommendationsPanel";
import { TeamNeedsPanel } from "@/components/fantasy-draft/TeamNeedsPanel";
import type {
  FantasyDraftPlayerDetailView,
  FantasyDraftView,
} from "@/state/selectors";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { OvrBadge } from "@/components/ui/OvrBadge";

type Props = {
  saveId: string;
  draft: FantasyDraftView;
  error?: string;
};

type PendingPlayer = {
  playerId: string;
  name: string;
  position: string;
  overall: number;
  potential: number;
};

export function FantasyDraftBoard({ saveId, draft, error }: Props) {
  const [pendingPlayer, setPendingPlayer] = useState<PendingPlayer | null>(
    null,
  );
  const [playerDetail, setPlayerDetail] =
    useState<FantasyDraftPlayerDetailView | null>(null);
  const [pending, startTransition] = useTransition();
  const quickDraftFormRef = useRef<HTMLFormElement>(null);
  const [quickDraftPlayerId, setQuickDraftPlayerId] = useState<string | null>(
    null,
  );

  const canDraft =
    draft.userOnClock &&
    !draft.paused &&
    draft.onClockTeamId === draft.activeOwnerTeamId;

  const requestDraft = useCallback(
    (player: PendingPlayer) => {
      if (draft.settings.confirmPicks) {
        setPendingPlayer(player);
        return;
      }
      setQuickDraftPlayerId(player.playerId);
      startTransition(() => {
        queueMicrotask(() => quickDraftFormRef.current?.requestSubmit());
      });
    },
    [draft.settings.confirmPicks],
  );

  const openPlayer = useCallback(
    (playerId: string) => {
      startTransition(async () => {
        const detail = await fetchFantasyDraftPlayerDetailAction(
          saveId,
          playerId,
        );
        if (detail) {
          setPlayerDetail(detail);
        }
      });
    },
    [saveId],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <DraftHeader draft={draft} />

      {error ? (
        <p className="rounded-md border border-danger/50 bg-danger-soft px-3 py-2 text-sm text-danger-ink">
          {error}
        </p>
      ) : null}

      <DraftAutoPickControls saveId={saveId} draft={draft} />

      <ControlledFranchisesPanel saveId={saveId} draft={draft} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <PlayerPoolTable
            draft={draft}
            pending={pending}
            onOpenPlayer={openPlayer}
            onRequestDraft={requestDraft}
          />
        </div>

        <aside className="space-y-4">
          <DraftQueuePanel
            saveId={saveId}
            draft={draft}
            pending={pending}
            onConfirmDraft={requestDraft}
          />
          <TeamNeedsPanel draft={draft} />
          <RecommendationsPanel draft={draft} />
          <section className="rounded-xl border border-line p-4">
            <SectionHeading
              title={`Current roster (${draft.activeRoster.length}/${draft.picksPerTeam})`}
              className="mb-2"
            />
            <div className="mb-3 flex flex-wrap gap-2 text-sm text-muted">
              {draft.positionCounts.map((row) => (
                <span key={row.position}>
                  {row.position}: {row.count}
                </span>
              ))}
            </div>
            <ul className="space-y-1 text-sm">
              {draft.activeRoster.length === 0 ? (
                <li className="text-faint">Empty</li>
              ) : (
                draft.activeRoster.map((p) => (
                  <li key={p.playerId}>
                    <span className="text-faint">{p.position}</span> {p.name}{" "}
                    <OvrBadge
                      overall={p.overall}
                      size="sm"
                      className="align-middle"
                    />
                  </li>
                ))
              )}
            </ul>
          </section>
          <DraftHistoryPanel draft={draft} />
          <section className="rounded-xl border border-line p-4">
            <SectionHeading title="Draft order" className="mb-2" />
            <ol className="max-h-64 space-y-1 overflow-y-auto text-sm">
              {draft.draftOrder.map((entry) => (
                <li
                  key={entry.teamId}
                  className={
                    entry.teamId === draft.onClockTeamId
                      ? "text-team-ink"
                      : "text-muted"
                  }
                >
                  {entry.pickNumber}. {entry.abbreviation}
                  {entry.isUser ? " · USER" : ""}
                </li>
              ))}
            </ol>
          </section>
          <DraftSettingsPanel saveId={saveId} draft={draft} />
        </aside>
      </div>

      <form
        ref={quickDraftFormRef}
        action={fantasyDraftPickAction}
        className="hidden"
      >
        <input type="hidden" name="saveId" value={saveId} />
        <input type="hidden" name="playerId" value={quickDraftPlayerId ?? ""} />
      </form>

      {playerDetail ? (
        <FantasyDraftPlayerPanel
          saveId={saveId}
          teamId={draft.activeOwnerTeamId}
          detail={playerDetail}
          canDraft={canDraft}
          confirmPicks={draft.settings.confirmPicks}
          pending={pending}
          onClose={() => setPlayerDetail(null)}
          onRequestDraft={(player) => {
            setPlayerDetail(null);
            requestDraft(player);
          }}
        />
      ) : null}

      {pendingPlayer ? (
        <DraftConfirmDialog
          saveId={saveId}
          player={pendingPlayer}
          pending={pending}
          onCancel={() => setPendingPlayer(null)}
          onSubmitStart={() => {
            startTransition(() => setPendingPlayer(null));
          }}
        />
      ) : null}
    </div>
  );
}
