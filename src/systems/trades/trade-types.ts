export type TradeValidationIssue = {
  code: string;
  message: string;
};

export type TradeValidationResult = {
  valid: boolean;
  errors: TradeValidationIssue[];
  warnings: TradeValidationIssue[];
};
