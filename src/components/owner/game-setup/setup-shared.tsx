import type { ReactNode } from "react";
import { secondaryButtonClass } from "@/components/owner/game-setup/fields";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn, focusRingClass } from "@/components/ui/styles";

export function ErrorList({ errors }: { errors: readonly string[] }) {
  return (
    <ul
      role="alert"
      className="space-y-1 rounded-md border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-300"
    >
      {errors.map((error) => (
        <li key={error}>{error}</li>
      ))}
    </ul>
  );
}

export function ControlButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-md px-3 py-1.5 text-sm",
        focusRingClass,
        selected
          ? "bg-team text-on-team"
          : "border border-line-strong text-soft hover:border-team-ink",
      )}
    >
      {children}
    </button>
  );
}

export function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-faint">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

export function ReviewGroup({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="space-y-3 rounded-lg border border-line bg-surface-base/60 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <SectionHeading as="h3" title={title} />
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${title}`}
          className={secondaryButtonClass}
        >
          Edit
        </button>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">{children}</dl>
    </section>
  );
}

export function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-faint">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
