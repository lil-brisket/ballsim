import { cn } from "@/components/ui/styles";

/** Win/loss streak as a small coloured chip ("W4" / "L2"). */
export function StreakChip(props: { label: string; className?: string }) {
  const isWin = props.label.startsWith("W");
  const isLoss = props.label.startsWith("L");
  if (!isWin && !isLoss) {
    return <span className="text-zinc-500">{props.label}</span>;
  }
  return (
    <span
      className={cn(
        "inline-flex min-w-8 items-center justify-center rounded-md px-1.5 py-0.5 text-sm font-semibold tabular-nums",
        isWin ? "bg-win/15 text-win" : "bg-loss/15 text-loss",
        props.className,
      )}
    >
      {props.label}
    </span>
  );
}
