"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { PlayerRatingGrid } from "@/components/basketball/PlayerRatingGrid";
import { PlayerProfileHero } from "@/components/basketball/PlayerProfileHero";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { Drawer } from "@/components/ui/Drawer";
import { Section } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ScoreNumeral } from "@/components/ui/ScoreNumeral";
import { cn, focusRingClass, touchTargetClass } from "@/components/ui/styles";
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

function StatTile(props: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-surface-line border-b-team-ink bg-surface-deep/80 px-3 py-3">
      <ScoreNumeral value={props.value} label={props.label} labelBelow />
    </div>
  );
}

const primaryActionClass = cn(
  touchTargetClass,
  "rounded-md bg-amber-600 px-4 text-sm font-medium text-zinc-950 hover:bg-amber-500",
  focusRingClass,
);

const secondaryActionClass = cn(
  touchTargetClass,
  "rounded-md border border-zinc-700 px-4 text-sm text-zinc-300 hover:border-zinc-500",
  focusRingClass,
);

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
      size="xl"
      onBodyElement={(element) => {
        bodyRef.current = element;
      }}
      footer={
        props.view ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link
              href={props.view.navigation.playerHref}
              className={primaryActionClass}
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
            <button
              type="button"
              onClick={props.onRetry}
              className={cn(
                "rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-amber-600",
                focusRingClass,
              )}
            >
              Try again
            </button>
          ) : null}
        </div>
      ) : null}

      {props.status === "missing" ? (
        <p className="text-sm text-zinc-400" role="status">
          Player no longer exists.
        </p>
      ) : null}

      {props.status === "ready" && props.view ? (
        <div className="space-y-6">
          <PlayerProfileHero
            playerId={props.view.playerId}
            portrait={props.view.portrait}
            firstName={props.view.identity.firstName}
            lastName={props.view.identity.lastName}
            position={props.view.identity.position}
            age={props.view.identity.age}
            overall={props.view.identity.overall}
            potential={props.view.identity.potential}
            archetypeLabel={props.view.identity.archetypeLabel}
            heightInches={props.view.identity.heightInches}
            weightPounds={props.view.identity.weightPounds}
            teamName={props.view.team.teamName}
            teamAbbreviation={props.view.team.abbreviation}
            branding={props.view.team.branding}
            availabilityStatus={props.view.availability.status}
          />

          <Section title="Ratings" density="compact">
            <PlayerRatingGrid
              key={props.view.playerId}
              attributes={props.view.ratings.attributes}
            />
          </Section>

          <Section title="Season averages" density="compact">
            <div
              role="group"
              aria-label="Season averages"
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              <StatTile label="GP" value={props.view.performance.games} />
              <StatTile label="PPG" value={props.view.performance.ppg ?? "—"} />
              <StatTile label="RPG" value={props.view.performance.rpg ?? "—"} />
              <StatTile label="APG" value={props.view.performance.apg ?? "—"} />
            </div>
          </Section>

          {props.view.contract ? (
            <Section title="Contract" density="compact">
              <div
                role="group"
                aria-label="Contract"
                className="grid grid-cols-3 gap-2"
              >
                <StatTile
                  label="Salary"
                  value={
                    props.view.contract.salary != null ? (
                      <span className="text-2xl sm:text-3xl">
                        <MoneyDisplay amount={props.view.contract.salary} />
                      </span>
                    ) : (
                      "—"
                    )
                  }
                />
                <StatTile
                  label="Years"
                  value={props.view.contract.yearsRemaining}
                />
                <div className="flex min-w-0 flex-col items-start justify-center gap-1 rounded-lg border border-surface-line border-b-team-ink bg-surface-deep/80 px-3 py-3">
                  <StatusBadge label={props.view.contract.status} />
                  <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-zinc-400">
                    Status
                  </span>
                </div>
              </div>
            </Section>
          ) : props.view.navigation.contractHref ? (
            <Section title="Contract" density="compact">
              <p className="text-sm text-zinc-400">
                Contract details unavailable
              </p>
            </Section>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}
