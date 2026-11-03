"use client";

import { useState } from "react";
import { executeTradeAction } from "@/application/actions";
import { PlayerAttributeTrends } from "@/components/player-profile/PlayerAttributeTrends";
import { PlayerCareer } from "@/components/player-profile/PlayerCareer";
import { PlayerContract } from "@/components/player-profile/PlayerContract";
import { DevelopmentLeaguePlayerActions } from "@/components/player-profile/DevelopmentLeaguePlayerActions";
import { PlayerGameLog } from "@/components/player-profile/PlayerGameLog";
import { FormDoneWatcher } from "@/components/contracts/dialog-support";
import { ConfirmDialog } from "@/components/owner/ConfirmDialog";
import { Button, buttonClass } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import type { ProfileEntry } from "./usePlayerProfileData";

export function ProfileSkeleton() {
  return (
    <div
      className="animate-pulse space-y-3 motion-reduce:animate-none"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="h-8 w-1/3 rounded-lg bg-surface-high" />
      <div className="h-40 rounded-lg bg-surface-high" />
      <div className="h-24 rounded-lg bg-surface-high" />
    </div>
  );
}

/** Renders the loading / error / unavailable states, or `children(data)`. */
export function ProfileGate(props: {
  entry: ProfileEntry | undefined;
  onRetry: () => void;
  children: (
    data: Extract<ProfileEntry, { status: "ready" }>["data"],
  ) => React.ReactNode;
}) {
  const { entry } = props;
  if (!entry || entry.status === "loading") return <ProfileSkeleton />;
  if (entry.status === "error") {
    return (
      <div className="space-y-3" role="alert">
        <p className="text-sm text-danger-ink">Unable to load this section.</p>
        <Button type="button" variant="secondary" onClick={props.onRetry}>
          Try again
        </Button>
      </div>
    );
  }
  if (entry.status === "unavailable") {
    return (
      <p className="text-sm text-muted" role="status">
        Full profile details are not available for this player.
      </p>
    );
  }
  return <>{props.children(entry.data)}</>;
}

function TradeAction(props: {
  saveId: string;
  playerId: string;
  returnPath: string;
  onDone: () => void;
}) {
  // Remount after the action settles so the confirm dialog closes.
  const [round, setRound] = useState(0);
  return (
    <Section title="Actions">
      <ConfirmDialog
        key={round}
        portal
        title="Execute trade"
        description="Find and execute the first acceptable trade for this player. Does not trade a different roster player."
        confirmLabel="Trade"
      >
        <form action={executeTradeAction}>
          <input type="hidden" name="saveId" value={props.saveId} />
          <input type="hidden" name="outgoingPlayerId" value={props.playerId} />
          <input type="hidden" name="returnPath" value={props.returnPath} />
          <FormDoneWatcher
            onDone={() => {
              setRound((n) => n + 1);
              props.onDone();
            }}
          />
          <button type="submit" className={buttonClass({ variant: "primary" })}>
            Confirm trade
          </button>
        </form>
      </ConfirmDialog>
    </Section>
  );
}

export type ProfileTabKind = "development" | "gamelog" | "career" | "contract";

/** Dev League status/actions for the Overview tab (controlled players only). */
export function OverviewProfileExtras(props: {
  entry: ProfileEntry | undefined;
  saveId: string;
  playerId: string;
  returnPath: string;
  onActionDone: () => void;
}) {
  if (!props.entry || props.entry.status === "loading") {
    return (
      <div
        className="h-24 animate-pulse rounded-lg bg-surface-high motion-reduce:animate-none"
        aria-hidden
      />
    );
  }
  if (props.entry.status !== "ready") return null;
  const dev = props.entry.data.player.developmentLeague;
  return (
    <DevelopmentLeaguePlayerActions
      saveId={props.saveId}
      playerId={props.playerId}
      returnPath={props.returnPath}
      canAssign={dev.canAssign}
      canRecall={dev.canRecall}
      statusLabel={dev.statusLabel}
      readinessLabel={dev.readinessLabel}
      whyBullets={dev.whyBullets}
      onDone={props.onActionDone}
    />
  );
}

export function ProfileTabContent(props: {
  tab: ProfileTabKind;
  entry: ProfileEntry | undefined;
  saveId: string;
  playerId: string;
  returnPath: string;
  onRetry: () => void;
  onNavigate: () => void;
  onActionDone: () => void;
}) {
  if (props.tab === "development" && props.entry?.status === "unavailable") {
    return null;
  }
  return (
    <ProfileGate entry={props.entry} onRetry={props.onRetry}>
      {({ player, tradesOpen }) => {
        switch (props.tab) {
          case "development":
            return <PlayerAttributeTrends player={player} />;
          case "gamelog":
            return (
              <PlayerGameLog
                player={player}
                saveId={props.saveId}
                onNavigate={props.onNavigate}
              />
            );
          case "career":
            return (
              <PlayerCareer
                player={player}
                saveId={props.saveId}
                onNavigate={props.onNavigate}
              />
            );
          case "contract":
            return (
              <>
                <PlayerContract
                  player={player}
                  saveId={props.saveId}
                  inDrawer
                />
                {player.onControlledRoster && tradesOpen ? (
                  <TradeAction
                    saveId={props.saveId}
                    playerId={props.playerId}
                    returnPath={props.returnPath}
                    onDone={props.onActionDone}
                  />
                ) : null}
              </>
            );
        }
      }}
    </ProfileGate>
  );
}
