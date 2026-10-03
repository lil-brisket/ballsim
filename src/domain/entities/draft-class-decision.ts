export type DraftClassDecisionSource = "generated" | "custom";

export type PendingDraftClassDecision = {
  draftYear: number;
  resolved: boolean;
  source?: DraftClassDecisionSource;
  customContentId?: string;
};
