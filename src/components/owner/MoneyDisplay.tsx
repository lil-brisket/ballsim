import { formatMoney } from "@/domain/owner-objective-text";

export { formatMoney };

export function MoneyDisplay(props: { amount: number; className?: string }) {
  return (
    <span className={`font-mono tabular-nums ${props.className ?? ""}`}>
      {formatMoney(props.amount)}
    </span>
  );
}
