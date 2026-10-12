export type PortraitAssignDecision = "skip" | "copy" | "fallback";

/**
 * Idempotent overlay assignment without image-generation APIs or simulation RNG.
 * copy: source file exists and destination does not.
 * skip: destination already exists.
 * fallback: no source; UI keeps the deterministic SVG.
 */
export function decidePortraitOverlayAssignment(input: {
  destinationExists: boolean;
  sourceExists: boolean;
}): PortraitAssignDecision {
  if (input.destinationExists) {
    return "skip";
  }
  if (input.sourceExists) {
    return "copy";
  }
  return "fallback";
}
