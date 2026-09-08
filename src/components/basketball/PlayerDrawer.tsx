"use client";

import Link from "next/link";
import { InjuryBadge } from "@/components/basketball/InjuryBadge";
import { PlayerCard } from "@/components/basketball/PlayerCard";
import { StatLine } from "@/components/basketball/StatLine";
import { Drawer } from "@/components/ui/Drawer";
import { Section } from "@/components/ui/Section";
import { focusRingClass, cn } from "@/components/ui/styles";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import type { PlayerDrawerView } from "@/state/entity-drawer-selectors";

function DrawerSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-16 rounded-lg bg-zinc-800" />
      <div className="h-8 w-2/3 rounded bg-zinc-800" />
      <div className="h-24 rounded-lg bg-zinc-800" />
      <div className="h-24 rounded-lg bg-zinc-800" />
    </div>
  );
}

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
              href={props.view.navigation.playerHref}
              className={cn(
                "rounded-md border border-amber-700/50 bg-amber-950/40 px-3 py-1.5 text-sm text-amber-300 hover:border-amber-600",
                focusRingClass,
              )}
              onClick={() => props.onOpenChange(false)}
            >
              View full player
            </Link>
            {props.view.navigation.contractHref ? (
              <Link
                href={props.view.navigation.contractHref}
                className={cn(
                  "rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500",
                  focusRingClass,
                )}
                onClick={() => props.onOpenChange(false)}
              >
                View contract
              </Link>
            ) : null}
            {props.view.navigation.developmentHref ? (
              <Link
                href={props.view.navigation.developmentHref}
                className={cn(
                  "rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500",
                  focusRingClass,
                )}
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
          <PlayerCard
            bare
            firstName={props.view.identity.firstName}
            lastName={props.view.identity.lastName}
            position={props.view.identity.position}
            age={props.view.identity.age}
            overall={props.view.identity.overall}
            teamName={props.view.team.teamName}
            teamAbbreviation={props.view.team.abbreviation}
            injuryStatus={props.view.availability.status}
            fields={{ role: false, contract: false }}
          />

          <Section title="Availability" density="compact">
            <InjuryBadge status={props.view.availability.status} />
          </Section>

          {props.view.ratings.keyAttributes.length > 0 ? (
            <Section title="Key ratings" density="compact">
              <StatLine
                density="compact"
                items={props.view.ratings.keyAttributes.map((a) => ({
                  label: a.attribute,
                  value: a.rating,
                }))}
              />
            </Section>
          ) : null}

          {props.view.performance.games > 0 ? (
            <Section title="Season averages" density="compact">
              <StatLine
                items={[
                  { label: "GP", value: props.view.performance.games },
                  {
                    label: "PPG",
                    value: props.view.performance.ppg ?? "—",
                  },
                  {
                    label: "RPG",
                    value: props.view.performance.rpg ?? "—",
                  },
                  {
                    label: "APG",
                    value: props.view.performance.apg ?? "—",
                  },
                ]}
              />
            </Section>
          ) : null}

          {props.view.contract ? (
            <Section title="Contract" density="compact">
              <StatLine
                items={[
                  {
                    label: "Salary",
                    value: props.view.contract.salary != null ? (
                      <MoneyDisplay amount={props.view.contract.salary} />
                    ) : (
                      "—"
                    ),
                  },
                  {
                    label: "Years",
                    value: props.view.contract.yearsRemaining,
                  },
                  {
                    label: "Status",
                    value: props.view.contract.status,
                  },
                ]}
              />
            </Section>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}
