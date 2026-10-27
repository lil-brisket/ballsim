"use client";

import { useState, useTransition, type ReactNode } from "react";
import { updateCustomRosterPlayerAction } from "@/application/actions";
import { buttonClass } from "@/components/ui/Button";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { inputClass } from "@/components/owner/game-setup/fields";
import { RATING_MAX, RATING_MIN } from "@/domain/entities/player";
import type { PlayerAttributes } from "@/domain/entities/player";
import {
  RATING_CATEGORIES,
  formatAttributeLabel,
} from "@/presentation/player-rating-categories";
import { SectionHeading } from "@/components/ui/SectionHeading";

export type RosterEditorPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  potential: number;
  attributes: PlayerAttributes;
};

/** Exactly what `updateCustomRosterPlayerAction` receives as `patchJson`. */
export function buildPlayerPatch(values: {
  firstName: string;
  lastName: string;
  age: number;
  potential: number;
  attributes: PlayerAttributes;
}) {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    age: values.age,
    potential: { overall: values.potential },
    attributes: { ...values.attributes },
  };
}

function StepperField(props: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1 text-sm text-soft">
      <span className="block">{props.label}</span>
      {props.children}
    </div>
  );
}

export function RosterEditorForm(props: {
  saveId: string;
  returnPath: string;
  player: RosterEditorPlayer;
}) {
  const { player } = props;
  const [firstName, setFirstName] = useState(player.firstName);
  const [lastName, setLastName] = useState(player.lastName);
  const [age, setAge] = useState(player.age);
  const [potential, setPotential] = useState(player.potential);
  const [attributes, setAttributes] = useState<PlayerAttributes>({
    ...player.attributes,
  });
  const [pending, startTransition] = useTransition();
  const patch = buildPlayerPatch({
    firstName,
    lastName,
    age,
    potential,
    attributes,
  });

  return (
    <form
      className="space-y-5"
      action={(formData) => {
        startTransition(() => {
          void updateCustomRosterPlayerAction(formData);
        });
      }}
    >
      <input type="hidden" name="saveId" value={props.saveId} />
      <input type="hidden" name="playerId" value={player.id} />
      <input type="hidden" name="returnPath" value={props.returnPath} />
      <input type="hidden" name="patchJson" value={JSON.stringify(patch)} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block space-y-1 text-sm text-soft">
          <span>First name</span>
          <input
            type="text"
            value={firstName}
            required
            onChange={(event) => setFirstName(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block space-y-1 text-sm text-soft">
          <span>Last name</span>
          <input
            type="text"
            value={lastName}
            required
            onChange={(event) => setLastName(event.target.value)}
            className={inputClass}
          />
        </label>
        <StepperField label="Age">
          <NumberStepper
            aria-label="Age"
            min={16}
            max={50}
            value={age}
            onValueChange={setAge}
          />
        </StepperField>
        <StepperField label="Potential">
          <NumberStepper
            aria-label="Potential"
            min={RATING_MIN}
            max={RATING_MAX}
            value={potential}
            onValueChange={setPotential}
          />
        </StepperField>
      </div>

      {RATING_CATEGORIES.map((category) => (
        <fieldset key={category.key} className="m-0 min-w-0 border-0 p-0">
          <legend className="mb-2 p-0">
            <SectionHeading as="h3" title={category.label} />
          </legend>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {category.attributes.map((key) => (
              <StepperField key={key} label={formatAttributeLabel(key)}>
                <NumberStepper
                  aria-label={formatAttributeLabel(key)}
                  min={RATING_MIN}
                  max={RATING_MAX}
                  value={attributes[key]}
                  onValueChange={(value) =>
                    setAttributes({ ...attributes, [key]: value })
                  }
                />
              </StepperField>
            ))}
          </div>
        </fieldset>
      ))}

      <button
        type="submit"
        disabled={pending}
        className={buttonClass({ variant: "primary" })}
      >
        {pending ? "Saving…" : "Save player"}
      </button>
    </form>
  );
}
