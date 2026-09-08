"use client";

import Link from "next/link";
import { InjuryBadge } from "@/components/basketball/InjuryBadge";
import { RosterRow } from "@/components/basketball/RosterRow";
import { TeamCard } from "@/components/basketball/TeamCard";
import { StatLine } from "@/components/basketball/StatLine";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { Drawer } from "@/components/ui/Drawer";
import { Section } from "@/components/ui/Section";
import { cn, focusRingClass } from "@/components/ui/styles";
import type { TeamDrawerView } from "@/state/entity-drawer-selectors";

function DrawerSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-20 rounded-lg bg-zinc-800" />
      <div className="h-8 w-1/2 rounded bg-zinc-800" />
      <div className="h-32 rounded-lg bg-zinc-800" />
    </div>
  );
}

export function TeamDrawer(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saveId: string;
  status: "idle" | "loading" | "ready" | "error" | "missing";
  view: TeamDrawerView | null;
  onRetry?: () => void;
}) {
  const title = props.view
    ? `${props.view.identity.city} ${props.view.identity.name}`
    : "Team";

  const streakLabel =
    props.view?.performance.streak.type &&
    props.view.performance.streak.count > 0
      ? `${props.view.performance.streak.count}${props.view.performance.streak.type}`
      : null;

  return (
    <Drawer
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={title}
      size="md"
      footer={
        props.view ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href={props.view.navigation.teamHref}
              className={cn(
                "rounded-md border border-amber-700/50 bg-amber-950/40 px-3 py-1.5 text-sm text-amber-300 hover:border-amber-600",
                focusRingClass,
              )}
              onClick={() => props.onOpenChange(false)}
            >
              View team
            </Link>
            {props.view.navigation.rosterHref ? (
              <Link
                href={props.view.navigation.rosterHref}
                className={cn(
                  "rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500",
                  focusRingClass,
                )}
                onClick={() => props.onOpenChange(false)}
              >
                View roster
              </Link>
            ) : null}
            <Link
              href={props.view.navigation.scheduleHref}
              className={cn(
                "rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500",
                focusRingClass,
              )}
              onClick={() => props.onOpenChange(false)}
            >
              View schedule
            </Link>
          </div>
        ) : null
      }
    >
      {props.status === "loading" || props.status === "idle" ? (
        <DrawerSkeleton />
      ) : null}

      {props.status === "error" ? (
        <div className="space-y-3" role="alert">
          <p className="text-sm text-rose-200">Unable to load team.</p>
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
          Team no longer exists.
        </p>
      ) : null}

      {props.status === "ready" && props.view ? (
        <div className="space-y-6">
          <TeamCard
            bare
            city={props.view.identity.city}
            name={props.view.identity.name}
            abbreviation={props.view.identity.abbreviation}
            branding={props.view.identity.branding}
            wins={props.view.performance.wins}
            losses={props.view.performance.losses}
            rank={props.view.performance.rank}
            conference={props.view.identity.conference}
            division={props.view.identity.division}
          />

          {streakLabel ? (
            <Section title="Form" density="compact">
              <StatLine
                items={[{ label: "Streak", value: streakLabel }]}
              />
            </Section>
          ) : null}

          {props.view.roster.topPlayers.length > 0 ? (
            <Section title="Key players" density="compact">
              <div>
                {props.view.roster.topPlayers.map((player) => (
                  <RosterRow
                    key={player.playerId}
                    saveId={props.saveId}
                    playerId={player.playerId}
                    firstName={player.firstName}
                    lastName={player.lastName}
                    position={player.position}
                    overall={player.overall}
                    injuryStatus={
                      player.injuryStatus !== "available"
                        ? player.injuryStatus
                        : undefined
                    }
                    density="compact"
                  />
                ))}
              </div>
            </Section>
          ) : null}

          {props.view.roster.injuryHighlights.length > 0 ? (
            <Section title="Injuries" density="compact">
              <ul className="space-y-2">
                {props.view.roster.injuryHighlights.map((player) => (
                  <li
                    key={player.playerId}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="text-zinc-300">
                      {player.firstName} {player.lastName}
                    </span>
                    <InjuryBadge status={player.injuryStatus} />
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {props.view.context ? (
            <Section title="Franchise" density="compact">
              <StatLine
                items={[
                  {
                    label: "Payroll",
                    value: (
                      <MoneyDisplay amount={props.view.context.payroll} />
                    ),
                  },
                  {
                    label: "Cap space",
                    value: (
                      <MoneyDisplay amount={props.view.context.capSpace} />
                    ),
                  },
                  {
                    label: "Ownership",
                    value:
                      props.view.context.ownerStatus === "active"
                        ? "Active"
                        : "Owned",
                  },
                ]}
              />
            </Section>
          ) : null}

          {props.view.recentGames.length > 0 ? (
            <Section title="Recent games" density="compact">
              <ul className="space-y-2">
                {props.view.recentGames.map((game) => (
                  <li
                    key={game.gameId}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="text-zinc-400">
                      {game.home ? "vs" : "@"} {game.opponentAbbreviation}
                    </span>
                    <span
                      className={
                        game.won ? "font-mono text-emerald-400" : "font-mono text-rose-300"
                      }
                    >
                      {game.teamScore}–{game.opponentScore}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}
