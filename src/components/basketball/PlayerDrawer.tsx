"use client";

import { Button, buttonClass } from "@/components/ui/Button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ExtendContractDialog } from "@/components/contracts/ExtendContractDialog";
import { ReleasePlayerDialog } from "@/components/contracts/ReleasePlayerDialog";
import { PlayerProfileHero } from "@/components/basketball/PlayerProfileHero";
import { AttributesTab } from "@/components/basketball/player-card/AttributesTab";
import { DevelopmentTab } from "@/components/basketball/player-card/DevelopmentTab";
import { OverviewTab } from "@/components/basketball/player-card/OverviewTab";
import {
  PlayerCardTabList,
  PlayerCardTabPanel,
  type PlayerCardTabId,
} from "@/components/basketball/player-card/PlayerCardTabs";
import {
  OverviewProfileExtras,
  ProfileTabContent,
} from "@/components/basketball/player-card/ProfileTabs";
import { usePlayerProfileData } from "@/components/basketball/player-card/usePlayerProfileData";
import { StatisticsTab } from "@/components/basketball/player-card/StatisticsTab";
import { cn } from "@/components/ui/styles";
import { Drawer } from "@/components/ui/Drawer";
import type { PlayerDrawerView } from "@/state/entity-drawer-selectors";

function DrawerSkeleton() {
  return (
    <div
      className="animate-pulse space-y-4 motion-reduce:animate-none"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="h-56 rounded-xl bg-surface-high sm:h-52" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="h-24 rounded-lg bg-surface-high" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-20 rounded-lg bg-surface-high" />
        ))}
      </div>
    </div>
  );
}

const PROFILE_TABS = new Set<PlayerCardTabId>([
  "development",
  "gamelog",
  "career",
  "contract",
]);

function PlayerCardBody(props: {
  view: PlayerDrawerView;
  onTabChange: () => void;
  profile: ReturnType<typeof usePlayerProfileData>;
  returnPath: string;
  onNavigate: () => void;
  onActionDone: () => void;
}) {
  const [tab, setTab] = useState<PlayerCardTabId>("overview");
  const baseId = useId();
  const { view, profile } = props;
  const { ensure } = profile;
  const needsProfile =
    PROFILE_TABS.has(tab) ||
    (tab === "overview" && view.actions.onControlledRoster);
  const entry = profile.entries[view.playerId];

  useEffect(() => {
    if (needsProfile) ensure(view.playerId);
  }, [needsProfile, ensure, view.playerId]);

  function afterAction() {
    profile.refresh(view.playerId);
    props.onActionDone();
  }

  function changeTab(next: PlayerCardTabId) {
    if (next === tab) return;
    setTab(next);
    props.onTabChange();
  }

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 -mt-4 bg-surface-raised px-4 pt-2 border-b border-line">
        <PlayerCardTabList baseId={baseId} active={tab} onChange={changeTab} />
      </div>
      <PlayerCardTabPanel baseId={baseId} tab={tab}>
        <PlayerProfileHero
          variant={tab === "overview" ? "full" : "compact"}
          playerId={view.playerId}
          portrait={view.portrait}
          firstName={view.identity.firstName}
          lastName={view.identity.lastName}
          jerseyNumber={view.identity.jerseyNumber}
          position={view.identity.position}
          secondaryPosition={view.identity.secondaryPosition}
          age={view.identity.age}
          overall={view.identity.overall}
          potential={view.identity.potential}
          archetypeLabel={view.identity.archetypeLabel}
          heightInches={view.identity.heightInches}
          weightPounds={view.identity.weightPounds}
          teamName={view.team.teamName}
          teamAbbreviation={view.team.abbreviation}
          branding={view.team.branding}
          availabilityStatus={view.availability.status}
        />
        {tab === "overview" ? <OverviewTab view={view} /> : null}
        {tab === "overview" && view.actions.onControlledRoster ? (
          <OverviewProfileExtras
            entry={entry}
            saveId={view.saveId}
            playerId={view.playerId}
            returnPath={props.returnPath}
            onActionDone={afterAction}
          />
        ) : null}
        {tab === "attributes" ? <AttributesTab view={view} /> : null}
        {tab === "statistics" ? (
          <StatisticsTab
            saveId={view.saveId}
            playerId={view.playerId}
            stats={view.stats}
          />
        ) : null}
        {tab === "development" ? (
          <>
            <DevelopmentTab
              identity={view.identity}
              development={view.development}
            />
            <ProfileTabContent
              tab="development"
              entry={entry}
              saveId={view.saveId}
              playerId={view.playerId}
              returnPath={props.returnPath}
              onRetry={() => profile.retry(view.playerId)}
              onNavigate={props.onNavigate}
              onActionDone={afterAction}
            />
          </>
        ) : null}
        {tab === "gamelog" || tab === "career" || tab === "contract" ? (
          <ProfileTabContent
            tab={tab}
            entry={entry}
            saveId={view.saveId}
            playerId={view.playerId}
            returnPath={props.returnPath}
            onRetry={() => profile.retry(view.playerId)}
            onNavigate={props.onNavigate}
            onActionDone={afterAction}
          />
        ) : null}
      </PlayerCardTabPanel>
    </div>
  );
}

const secondaryActionClass = buttonClass({ variant: "quiet" });

export function PlayerDrawer(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: "idle" | "loading" | "ready" | "error" | "missing";
  view: PlayerDrawerView | null;
  onRetry?: () => void;
  /** Called after an in-drawer contract action settles (refetch the view). */
  onActionComplete?: () => void;
}) {
  const [dialog, setDialog] = useState<"extend" | "release" | null>(null);
  const pathname = usePathname();
  const title = props.view
    ? `${props.view.identity.firstName} ${props.view.identity.lastName}`
    : "Player";
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const playerId = props.view?.playerId;
  const profile = usePlayerProfileData({
    saveId: props.view?.saveId ?? "",
    open: props.open,
  });

  useEffect(() => {
    if (!props.open) return;
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 0;
    }
  }, [props.open, playerId]);

  const view = props.view;
  const dialogsOpen = props.open && view !== null;
  const dialogs =
    dialogsOpen && view ? (
      <>
        {dialog === "extend" && view.actions.extension ? (
          <ExtendContractDialog
            saveId={view.saveId}
            playerId={view.playerId}
            playerName={title}
            returnPath={pathname ?? ""}
            extension={view.actions.extension}
            open
            hideTrigger
            onOpenChange={(next) => {
              if (!next) setDialog(null);
            }}
            onSubmitted={() => {
              setDialog(null);
              props.onActionComplete?.();
            }}
          />
        ) : null}
        {dialog === "release" && view.actions.release ? (
          <ReleasePlayerDialog
            saveId={view.saveId}
            playerId={view.playerId}
            playerName={title}
            returnPath={pathname ?? ""}
            release={view.actions.release}
            open
            hideTrigger
            onOpenChange={(next) => {
              if (!next) setDialog(null);
            }}
            onSubmitted={() => {
              setDialog(null);
              props.onActionComplete?.();
            }}
          />
        ) : null}
      </>
    ) : null;

  return (
    <Drawer
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={title}
      aria-label={title}
      header={<span aria-hidden />}
      size="xl"
      onBodyElement={(element) => {
        bodyRef.current = element;
      }}
      footer={
        props.view ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link
              href={`/dashboard/${props.view.saveId}/players/compare?a=${encodeURIComponent(props.view.playerId)}`}
              className={secondaryActionClass}
              onClick={() => props.onOpenChange(false)}
            >
              Compare
            </Link>
            {props.view.actions.extension ? (
              <Button
                type="button"
                variant="quiet"
                onClick={() => setDialog("extend")}
              >
                Extend contract
              </Button>
            ) : null}
            {props.view.actions.release ? (
              <Button
                type="button"
                variant="quiet"
                onClick={() => setDialog("release")}
              >
                Release
              </Button>
            ) : null}
            <Link
              href={props.view.navigation.playerHref}
              className={cn(secondaryActionClass, "text-faint sm:ml-auto")}
              onClick={() => props.onOpenChange(false)}
            >
              Open as page
            </Link>
            {dialogs}
          </div>
        ) : null
      }
    >
      {props.status === "loading" || props.status === "idle" ? (
        <DrawerSkeleton />
      ) : null}

      {props.status === "error" ? (
        <div className="space-y-3" role="alert">
          <p className="text-sm text-danger-ink">Unable to load player.</p>
          {props.onRetry ? (
            <Button type="button" variant="secondary" onClick={props.onRetry}>
              Try again
            </Button>
          ) : null}
        </div>
      ) : null}

      {props.status === "missing" ? (
        <p className="text-sm text-muted" role="status">
          Player no longer exists.
        </p>
      ) : null}

      {props.status === "ready" && props.view ? (
        <PlayerCardBody
          key={props.view.playerId}
          view={props.view}
          profile={profile}
          returnPath={pathname ?? ""}
          onNavigate={() => props.onOpenChange(false)}
          onActionDone={() => props.onActionComplete?.()}
          onTabChange={() => {
            if (bodyRef.current) bodyRef.current.scrollTop = 0;
          }}
        />
      ) : null}
    </Drawer>
  );
}
