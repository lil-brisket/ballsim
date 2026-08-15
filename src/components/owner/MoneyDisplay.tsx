export function formatMoney(amount: number): string {
  const millions = amount / 1_000_000;
  if (Math.abs(millions) >= 1) {
    return `$${millions.toFixed(1)}M`;
  }
  const thousands = amount / 1_000;
  if (Math.abs(thousands) >= 1) {
    return `$${thousands.toFixed(0)}K`;
  }
  return `$${amount.toLocaleString()}`;
}

export function MoneyDisplay(props: {
  amount: number;
  className?: string;
}) {
  return (
    <span className={`font-mono tabular-nums ${props.className ?? ""}`}>
      {formatMoney(props.amount)}
    </span>
  );
}
