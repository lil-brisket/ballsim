"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { PlayerProfileHero } from "@/components/basketball/PlayerProfileHero";
import { ProfileStatTiles } from "@/components/basketball/ProfileStatTiles";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { Drawer } from "@/components/ui/Drawer";
import { Section } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn, focusRingClass, touchTargetClass } from "@/components/ui/styles";
import type { PlayerDrawerView } from "@/state/entity-drawer-selectors";

function DrawerSkeleton() {
  return (
    <div
      className="animate-pulse space-y-4"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="h-28 rounded-lg bg-zinc-800" />
      <div className="h-8 w-2/3 rounded bg-zinc-800" />
      <div className="h-24 rounded-lg bg-zinc-800" />
      <div className="h-24 rounded-lg bg-zinc-800" />
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
  const bodyRef = useRef<HTMLDivElement>(null);
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
      placement="modal"
      bodyRef={bodyRef}
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
            firstName={props.view.identity.firstName}
            lastName={props.view.identity.lastName}
            position={props.view.identity.position}
            age={props.view.identity.age}
            overall={props.view.identity.overall}
            teamName={props.view.team.teamName}
            teamAbbreviation={props.view.team.abbreviation}
            branding={props.view.team.branding}
            availabilityStatus={props.view.availability.status}
          />

          {props.view.ratings.keyAttributes.length > 0 ? (
            <Section title="Key ratings" density="compact">
              <ProfileStatTiles
                items={props.view.ratings.keyAttributes.map((attribute) => ({
                  label: attribute.attribute,
                  value: attribute.rating == null ? "—" : attribute.rating,
                }))}
              />
            </Section>
          ) : null}

          <Section title="Season averages" density="compact">
            <ProfileStatTiles
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

          {props.view.contract ? (
            <Section title="Contract" density="compact">
              <ProfileStatTiles
                items={[
                  {
                    label: "Salary",
                    value:
                      props.view.contract.salary != null ? (
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
                    value: <StatusBadge label={props.view.contract.status} />,
                  },
                ]}
              />
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
