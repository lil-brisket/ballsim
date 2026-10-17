"use client";

import { Button, buttonClass } from "@/components/ui/Button";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { PlayerProfileHero } from "@/components/basketball/PlayerProfileHero";
import { AttributesTab } from "@/components/basketball/player-card/AttributesTab";
import { DevelopmentTab } from "@/components/basketball/player-card/DevelopmentTab";
import { OverviewTab } from "@/components/basketball/player-card/OverviewTab";
import {
  PlayerCardTabList,
  PlayerCardTabPanel,
  type PlayerCardTabId,
} from "@/components/basketball/player-card/PlayerCardTabs";
import { StatisticsTab } from "@/components/basketball/player-card/StatisticsTab";
import { Drawer } from "@/components/ui/Drawer";
import type { PlayerDrawerView } from "@/state/entity-drawer-selectors";

function DrawerSkeleton() {
  return (
    <div
      className="animate-pulse space-y-4 motion-reduce:animate-none"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="h-56 rounded-xl bg-zinc-800 sm:h-52" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="h-24 rounded-lg bg-zinc-800" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-20 rounded-lg bg-zinc-800" />
        ))}
      </div>
    </div>
  );
}

function PlayerCardBody(props: {
  view: PlayerDrawerView;
  onTabChange: () => void;
}) {
  const [tab, setTab] = useState<PlayerCardTabId>("overview");
  const baseId = useId();
  const { view } = props;

  function changeTab(next: PlayerCardTabId) {
    if (next === tab) return;
    setTab(next);
    props.onTabChange();
  }

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 -mt-4 bg-zinc-900 px-4 pt-2 border-b border-zinc-800">
        <PlayerCardTabList baseId={baseId} active={tab} onChange={changeTab} />
      </div>
      <PlayerCardTabPanel baseId={baseId} tab={tab}>
        <PlayerProfileHero
          variant={tab === "overview" ? "full" : "compact"}
          playerId={view.playerId}
          portrait={view.portrait}
          firstName={view.identity.firstName}
          lastName={view.identity.lastName}
          position={view.identity.position}
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
        {tab === "attributes" ? <AttributesTab view={view} /> : null}
        {tab === "statistics" ? (
          <StatisticsTab
            saveId={view.saveId}
            playerId={view.playerId}
            stats={view.stats}
          />
        ) : null}
        {tab === "development" ? (
          <DevelopmentTab
            identity={view.identity}
            development={view.development}
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
}) {
  const title = props.view
    ? `${props.view.identity.firstName} ${props.view.identity.lastName}`
    : "Player";
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const playerId = props.view?.playerId;

  useEffect(() => {
    if (!props.open) return;
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 0;
    }
  }, [props.open, playerId]);

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
              href={props.view.navigation.playerHref}
              className={buttonClass({ variant: "primary" })}
              onClick={() => props.onOpenChange(false)}
            >
              View full player
            </Link>
            {props.view.navigation.contractHref ? (
              <Link
                href={props.view.navigation.contractHref}
                className={secondaryActionClass}
                onClick={() => props.onOpenChange(false)}
              >
                View contract
              </Link>
            ) : null}
            {props.view.navigation.developmentHref ? (
              <Link
                href={props.view.navigation.developmentHref}
                className={secondaryActionClass}
                onClick={() => props.onOpenChange(false)}
              >
                View development
              </Link>
            ) : null}
          </div>
        ) : null
      }
    >
      {props.status === "loading" || props.status === "idle" ? (
        <DrawerSkeleton />
      ) : null}

      {props.status === "error" ? (
        <div className="space-y-3" role="alert">
          <p className="text-sm text-rose-200">Unable to load player.</p>
          {props.onRetry ? (
            <Button type="button" variant="secondary" onClick={props.onRetry}>
              Try again
            </Button>
          ) : null}
        </div>
      ) : null}

      {props.status === "missing" ? (
        <p className="text-sm text-zinc-400" role="status">
          Player no longer exists.
        </p>
      ) : null}

      {props.status === "ready" && props.view ? (
        <PlayerCardBody
          key={props.view.playerId}
          view={props.view}
          onTabChange={() => {
            if (bodyRef.current) bodyRef.current.scrollTop = 0;
          }}
        />
      ) : null}
    </Drawer>
  );
}
