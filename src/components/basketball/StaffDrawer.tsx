"use client";

import Link from "next/link";
import { Drawer } from "@/components/ui/Drawer";
import { Section } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { cn, focusRingClass } from "@/components/ui/styles";
import type { StaffDrawerView } from "@/state/entity-drawer-selectors";

function DrawerSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-16 rounded-lg bg-zinc-800" />
      <div className="h-8 w-2/3 rounded bg-zinc-800" />
      <div className="h-24 rounded-lg bg-zinc-800" />
    </div>
  );
}

export function StaffDrawer(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: "idle" | "loading" | "ready" | "error" | "missing";
  view: StaffDrawerView | null;
  onRetry?: () => void;
}) {
  const title = props.view
    ? `${props.view.identity.firstName} ${props.view.identity.lastName}`
    : "Staff";

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
              href={props.view.navigation.staffHref}
              className={cn(
                "rounded-md border border-amber-700/50 bg-amber-950/40 px-3 py-1.5 text-sm text-amber-300 hover:border-amber-600",
                focusRingClass,
              )}
              onClick={() => props.onOpenChange(false)}
            >
              View full profile
            </Link>
            <Link
              href={props.view.navigation.staffHubHref}
              className={cn(
                "rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500",
                focusRingClass,
              )}
              onClick={() => props.onOpenChange(false)}
            >
              Staff Directory
            </Link>
          </div>
        ) : null
      }
    >
      {props.status === "loading" || props.status === "idle" ? (
        <DrawerSkeleton />
      ) : null}
      {props.status === "error" ? (
        <div className="space-y-3 text-sm text-zinc-400">
          <p>Could not load staff member.</p>
          {props.onRetry ? (
            <button
              type="button"
              onClick={props.onRetry}
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-200"
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
      {props.status === "missing" ? (
        <p className="text-sm text-zinc-400">Staff member not found.</p>
      ) : null}
      {props.status === "ready" && props.view ? (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-zinc-400">
              {props.view.identity.roleLabel}
            </p>
            <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-zinc-500">OVR</dt>
                <dd className="text-lg font-semibold text-zinc-100">
                  {props.view.identity.overall}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">POT</dt>
                <dd className="text-lg font-semibold text-zinc-100">
                  {props.view.identity.potential}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Age</dt>
                <dd className="text-lg font-semibold text-zinc-100">
                  {props.view.identity.age}
                </dd>
              </div>
            </dl>
          </div>

          <Section title="Contract">
            <ul className="space-y-1 text-sm text-zinc-300">
              <li className="flex justify-between">
                <span>Salary</span>
                {props.view.contract.salary !== null ? (
                  <MoneyDisplay amount={props.view.contract.salary} />
                ) : (
                  <span>—</span>
                )}
              </li>
              <li className="flex justify-between">
                <span>Years left</span>
                <span>
                  {props.view.contract.yearsRemaining !== null
                    ? `${props.view.contract.yearsRemaining}y`
                    : "—"}
                </span>
              </li>
            </ul>
          </Section>

          <Section title="Development">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusBadge label={props.view.development.trend} />
              <span className="text-zinc-400">
                Morale {props.view.development.morale}
              </span>
            </div>
          </Section>

          <Section title="Strengths">
            <p className="text-sm text-zinc-300">
              {props.view.strengths.join(", ") || "—"}
            </p>
          </Section>
        </div>
      ) : null}
    </Drawer>
  );
}
