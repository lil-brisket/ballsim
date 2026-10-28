import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/owner/game-setup/fields";

type StepActionsProps = {
  /** Reason the forward buttons are disabled, or null when ready. */
  blockedReason: string | null;
};

function BlockedNote({ blockedReason }: StepActionsProps) {
  return blockedReason ? (
    <p id="review-blocked-reason" className="text-sm text-muted">
      {blockedReason}
    </p>
  ) : null;
}

export function SetupStepActions({
  blockedReason,
  onNext,
  onSkipToReview,
  onReset,
}: StepActionsProps & {
  onNext: () => void;
  onSkipToReview: () => void;
  onReset: () => void;
}) {
  const blocked = blockedReason !== null;
  const describedBy = blockedReason ? "review-blocked-reason" : undefined;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={blocked}
          aria-describedby={describedBy}
          onClick={onNext}
          className={primaryButtonClass}
        >
          Next: Advanced settings
        </button>
        <button
          type="button"
          disabled={blocked}
          aria-describedby={describedBy}
          onClick={onSkipToReview}
          className={secondaryButtonClass}
        >
          Skip to review
        </button>
        <button
          type="button"
          onClick={onReset}
          className={secondaryButtonClass}
        >
          Reset to defaults
        </button>
      </div>
      <BlockedNote blockedReason={blockedReason} />
    </div>
  );
}

export function AdvancedStepActions({
  blockedReason,
  onBack,
  onReview,
}: StepActionsProps & { onBack: () => void; onReview: () => void }) {
  const blocked = blockedReason !== null;
  const describedBy = blockedReason ? "review-blocked-reason" : undefined;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onBack} className={secondaryButtonClass}>
          Back
        </button>
        <button
          type="button"
          disabled={blocked}
          aria-describedby={describedBy}
          onClick={onReview}
          className={primaryButtonClass}
        >
          Review and create
        </button>
      </div>
      <BlockedNote blockedReason={blockedReason} />
    </div>
  );
}
