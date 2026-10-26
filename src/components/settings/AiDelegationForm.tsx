"use client";

import { useState, useTransition } from "react";
import { setFranchiseAiAssistanceAction } from "@/application/actions";
import { buttonClass } from "@/components/ui/Button";
import { AiTeamManagementSection } from "@/components/owner/ai-management";
import type { AiAssistancePhases } from "@/domain/game-settings";

export function AiDelegationForm(props: {
  saveId: string;
  returnPath: string;
  initial: AiAssistancePhases;
}) {
  const [assistance, setAssistance] = useState<AiAssistancePhases>(
    props.initial,
  );
  const [pending, startTransition] = useTransition();
  const changed = JSON.stringify(assistance) !== JSON.stringify(props.initial);

  return (
    <form
      className="space-y-4"
      action={(formData) => {
        startTransition(() => {
          void setFranchiseAiAssistanceAction(formData);
        });
      }}
    >
      <input type="hidden" name="saveId" value={props.saveId} />
      <input type="hidden" name="returnPath" value={props.returnPath} />
      <input
        type="hidden"
        name="assistanceJson"
        value={JSON.stringify(assistance)}
      />
      <AiTeamManagementSection
        assistance={assistance}
        onAssistanceChange={setAssistance}
      />
      <button
        type="submit"
        disabled={pending || !changed}
        className={buttonClass({ variant: "primary" })}
      >
        {pending ? "Saving…" : "Save delegation"}
      </button>
    </form>
  );
}
