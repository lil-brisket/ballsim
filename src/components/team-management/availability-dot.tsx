import { cn } from "@/components/ui/styles";

/** Semantic colour class for an availability status key or label. */
export function availabilityToneClass(statusOrLabel: string): string {
  const value = statusOrLabel.toLowerCase();
  if (value.includes("available") || value === "healthy") {
    return "text-win";
  }
  if (
    value.includes("question") ||
    value.includes("limited") ||
    value.includes("minor") ||
    value.includes("day")
  ) {
    return "text-warning";
  }
  return "text-loss";
}

/** Coloured dot; pair with visible or screen-reader text for the status. */
export function AvailabilityDot(props: { status: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-current",
        availabilityToneClass(props.status),
        props.className,
      )}
    />
  );
}
