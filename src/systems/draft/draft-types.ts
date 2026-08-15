export type DraftValidationIssue = {
  code: string;
  message: string;
};

export type DraftValidationResult = {
  valid: boolean;
  errors: DraftValidationIssue[];
  warnings: DraftValidationIssue[];
};
