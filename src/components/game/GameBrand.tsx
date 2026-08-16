type GameBrandProps = {
  size?: "splash" | "page";
  className?: string;
};

export function GameBrand(props: GameBrandProps) {
  const size = props.size ?? "page";
  const titleClass =
    size === "splash"
      ? "text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl md:text-6xl"
      : "text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl";

  return (
    <div className={props.className}>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-500">
        Basketball
      </p>
      <h1 className={`mt-2 ${titleClass}`}>Franchise Simulation</h1>
    </div>
  );
}
