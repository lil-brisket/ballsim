/**
 * Checks that fail today, keyed by `<project> <route>` (smoke) or
 * `<project> a11y <route>`. Each is marked as an expected failure, so the
 * suite stays green while the issue exists and goes red once it is fixed
 * (then delete the entry). Empty: every tracked issue has been fixed.
 */
export const KNOWN_ISSUES: Readonly<Record<string, string>> = {};
