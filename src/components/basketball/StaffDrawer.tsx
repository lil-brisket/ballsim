"use client";

import Link from "next/link";
import {
  fireStaffAction,
  renewStaffContractAction,
} from "@/application/actions";
import { ConfirmDialog } from "@/components/owner/ConfirmDialog";
import { MoneyDisplay, formatMoney } from "@/components/owner/MoneyDisplay";
import { StaffTermsDialog } from "@/components/staff-coaching/StaffTermsDialog";
import { Drawer } from "@/components/ui/Drawer";
import { Section } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn, focusRingClass } from "@/components/ui/styles";
import { STAFF_DEFAULT_CONTRACT_YEARS } from "@/systems/staff-config";
import type { StaffDrawerView } from "@/state/entity-drawer-selectors";

function DrawerSkeleton() {
  return (
    <div
      className="animate-pulse space-y-4"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="h-16 rounded-lg bg-zinc-800" />
      <div className="h-8 w-2/3 rounded bg-zinc-800" />
      <div className="h-24 rounded-lg bg-zinc-800" />
    </div>
  );
}

export function StaffDrawer(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saveId: string;
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
      description={props.view?.identity.roleLabel}
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
        <StaffDrawerBody saveId={props.saveId} view={props.view} />
      ) : null}
    </Drawer>
  );
}

function StaffDrawerBody(props: { saveId: string; view: StaffDrawerView }) {
  const { view, saveId } = props;
  const returnPath = view.navigation.staffHubHref;

  return (
    <div className="space-y-5">
      <p className="text-sm text-zinc-300">
        {view.identity.overall} OVR · Age {view.identity.age} ·{" "}
        {view.experience} yrs experience
      </p>

      <Section title="Profile">
        <div className="space-y-2 text-sm">
          <p className="text-zinc-300">
            <span className="text-zinc-500">Strengths </span>
            {view.strengths.join(", ") || "—"}
          </p>
          <p className="text-zinc-300">
            <span className="text-zinc-500">Weaknesses </span>
            {view.weaknesses.join(", ") || "—"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={view.development.trend} />
            <span className="text-zinc-400">
              Morale {view.development.morale}
            </span>
          </div>
        </div>
      </Section>

      <Section title="Attributes">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
          {view.attributes.map((entry) => (
            <div key={entry.key} className="flex justify-between gap-3 text-sm">
              <dt className="text-zinc-400">{entry.label}</dt>
              <dd className="font-medium tabular-nums text-zinc-100">
                {entry.value}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      {view.effects.length > 0 ? (
        <Section title="Impact">
          <dl className="space-y-1 text-sm">
            {view.effects.map((effect) => (
              <div
                key={effect.label}
                className="flex justify-between gap-3 text-zinc-300"
              >
                <dt>{effect.label}</dt>
                <dd className="tabular-nums text-zinc-100">{effect.value}</dd>
              </div>
            ))}
          </dl>
        </Section>
      ) : null}

      <Section title="Contract">
        {view.contractValue === null && view.contract.salary === null ? (
          <p className="text-sm text-zinc-400">No current contract</p>
        ) : (
          <ul className="space-y-1 text-sm text-zinc-300">
            <li className="flex justify-between">
              <span>Salary</span>
              {view.contract.salary !== null ? (
                <span>
                  <MoneyDisplay amount={view.contract.salary} /> / year
                </span>
              ) : (
                <span>—</span>
              )}
            </li>
            <li className="flex justify-between">
              <span>Years remaining</span>
              <span>
                {view.contract.yearsRemaining !== null
                  ? `${view.contract.yearsRemaining}`
                  : "—"}
              </span>
            </li>
            <li className="flex justify-between">
              <span>Remaining value</span>
              {view.contractValue !== null ? (
                <MoneyDisplay amount={view.contractValue} />
              ) : (
                <span>—</span>
              )}
            </li>
          </ul>
        )}

        {view.canManage ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <StaffTermsDialog
              title={`Extend ${view.identity.firstName} ${view.identity.lastName}`}
              triggerLabel="Extend Contract"
              submitLabel="Extend Contract"
              action={renewStaffContractAction}
              saveId={saveId}
              returnPath={returnPath}
              hiddenFields={{ staffId: view.staffId }}
              defaultAnnualSalary={view.contract.salary ?? 0}
              defaultYears={STAFF_DEFAULT_CONTRACT_YEARS}
              showTotalPreview
            />
            <ConfirmDialog
              title={`Fire ${view.identity.firstName} ${view.identity.lastName}`}
              description={
                view.buyoutAmount > 0
                  ? `This termination requires a buyout of ${formatMoney(view.buyoutAmount)}. The buyout is recalculated when you confirm.`
                  : "This staff member has no remaining guaranteed salary. Confirm to terminate."
              }
              confirmLabel="Fire Staff"
            >
              <form action={fireStaffAction}>
                <input type="hidden" name="saveId" value={saveId} />
                <input type="hidden" name="staffId" value={view.staffId} />
                <input type="hidden" name="returnPath" value={returnPath} />
                <button
                  type="submit"
                  className="rounded-md border border-rose-700 px-3 py-1.5 text-sm text-rose-300"
                >
                  Confirm fire
                </button>
              </form>
            </ConfirmDialog>
          </div>
        ) : null}
      </Section>
    </div>
  );
}
