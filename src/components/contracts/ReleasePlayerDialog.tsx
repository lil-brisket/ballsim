"use client";

import { DataTable, numericCellClass } from "@/components/ui/DataTable";
import { useId, useRef, useState } from "react";
import {
  DialogPortal,
  FormDoneWatcher,
  useDialogKeys,
} from "@/components/contracts/dialog-support";
import { releasePlayerAction } from "@/application/actions";
import { formatMoney, MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { Button } from "@/components/ui/Button";
import { Overlay } from "@/components/ui/Overlay";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn, focusRingClass } from "@/components/ui/styles";
import type { PlayerReleaseView } from "@/state/player-release-selectors";

type Mode = "waive" | "buyout";

/**
 * Release (waive / buyout) confirmation. Presentation only: the mutation
 * happens in releasePlayerAction after the owner confirms.
 */
export function ReleasePlayerDialog(props: {
  saveId: string;
  playerId: string;
  playerName: string;
  returnPath: string;
  release: PlayerReleaseView;
  /** Open on mount (deep link from the player drawer). */
  defaultOpen?: boolean;
  /** Controlled mode: the parent owns `open`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Do not render the built-in trigger button. */
  hideTrigger?: boolean;
  /** Called when the submitted action settles. */
  onSubmitted?: () => void;
}) {
  const { release } = props;
  const controlled = props.open !== undefined;
  const [innerOpen, setInnerOpen] = useState(props.defaultOpen ?? false);
  const open = controlled ? props.open === true : innerOpen;
  function setOpen(next: boolean) {
    if (!controlled) setInnerOpen(next);
    props.onOpenChange?.(next);
  }
  const [mode, setMode] = useState<Mode>("waive");
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useDialogKeys({
    open,
    dialogRef,
    triggerRef,
    onClose: () => setOpen(false),
  });

  const option = mode === "waive" ? release.waive : release.buyout;
  const blocked = release.blockedReason !== null;
  const buyoutPercent =
    release.buyout.buyoutRate !== null
      ? Math.round(release.buyout.buyoutRate * 100)
      : null;

  return (
    <>
      {props.hideTrigger ? null : (
        <Button
          ref={triggerRef}
          variant="danger"
          className="min-h-11 px-2.5"
          onClick={() => {
            setMode("waive");
            setOpen(true);
          }}
        >
          Release
        </Button>
      )}
      {open ? (
        <DialogPortal portal={controlled}>
          <Overlay
            className="flex items-center justify-center p-4"
            onClick={() => setOpen(false)}
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="relative z-10 max-h-full w-full max-w-lg overflow-y-auto rounded-xl border border-line-strong bg-surface-raised p-5 text-left shadow-xl"
            >
              <SectionHeading
                as="h3"
                id={titleId}
                title={`Release ${props.playerName}?`}
              />
              <form action={releasePlayerAction} className="mt-3 space-y-4">
                <input type="hidden" name="saveId" value={props.saveId} />
                <input type="hidden" name="playerId" value={props.playerId} />
                <input
                  type="hidden"
                  name="returnPath"
                  value={props.returnPath}
                />
                <input type="hidden" name="mode" value={mode} />
                <FormDoneWatcher onDone={props.onSubmitted} />

                <fieldset className="space-y-2">
                  <legend className="sr-only">Release type</legend>
                  <ModeChoice
                    name="release-mode"
                    value="waive"
                    checked={mode === "waive"}
                    onSelect={setMode}
                    label="Waive"
                    detail="Pay the rest of his contract on the original schedule."
                    amount={release.waive.totalDeadMoney}
                    amountLabel="Total dead money"
                  />
                  <ModeChoice
                    name="release-mode"
                    value="buyout"
                    checked={mode === "buyout"}
                    onSelect={setMode}
                    label="Buyout"
                    detail={
                      buyoutPercent !== null
                        ? `He accepts ${buyoutPercent}% of the remaining salary (${formatMoney(release.remainingSalary)}). You pay it now.`
                        : "He gives up part of his salary. You pay it now."
                    }
                    amount={release.buyout.cashNow}
                    amountLabel="Paid now"
                  />
                </fieldset>

                <DataTable
                  headers={[
                    "Season",
                    { label: "Cap hit", numeric: true },
                    { label: "Cash still due", numeric: true },
                  ]}
                >
                  {option.seasons.map((season) => (
                    <tr key={season.seasonYear}>
                      <td className="px-3 py-2">{season.seasonYear}</td>
                      <td className={`px-3 py-2 ${numericCellClass}`}>
                        <MoneyDisplay amount={season.capHit} />
                      </td>
                      <td className={`px-3 py-2 ${numericCellClass}`}>
                        {mode === "buyout" ? (
                          <span className="text-muted">Paid now</span>
                        ) : (
                          <MoneyDisplay amount={season.cashDue} />
                        )}
                      </td>
                    </tr>
                  ))}
                </DataTable>

                <p className="text-sm text-soft">
                  Cap space after:{" "}
                  <MoneyDisplay amount={option.capSpaceAfter} />
                </p>

                {blocked ? (
                  <p role="alert" className="text-sm text-danger-ink">
                    {release.blockedReason}
                  </p>
                ) : null}

                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="secondary" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="danger" disabled={blocked}>
                    {mode === "waive" ? "Waive player" : "Buy out player"}
                  </Button>
                </div>
              </form>
            </div>
          </Overlay>
        </DialogPortal>
      ) : null}
    </>
  );
}

function ModeChoice(props: {
  name: string;
  value: Mode;
  checked: boolean;
  onSelect: (mode: Mode) => void;
  label: string;
  detail: string;
  amount: number;
  amountLabel: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-team",
        props.checked
          ? "border-team bg-surface-high/60"
          : "border-line-strong hover:border-faint",
      )}
    >
      <input
        type="radio"
        name={props.name}
        value={props.value}
        checked={props.checked}
        onChange={() => props.onSelect(props.value)}
        className={cn("mt-1", focusRingClass)}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-ink">
          {props.label}
        </span>
        <span className="block text-sm text-muted">{props.detail}</span>
        <span className="block text-sm text-soft">
          {props.amountLabel}: <MoneyDisplay amount={props.amount} />
        </span>
      </span>
    </label>
  );
}
