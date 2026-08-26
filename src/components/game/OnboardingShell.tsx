import Link from "next/link";

export type OnboardingStep = "mode" | "setup" | "franchise";

const STEPS: { id: OnboardingStep; label: string }[] = [
  { id: "mode", label: "Mode" },
  { id: "setup", label: "Setup" },
  { id: "franchise", label: "Franchise" },
];

export function OnboardingShell(props: {
  step: OnboardingStep;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  fillViewport?: boolean;
}) {
  const stepIndex = STEPS.findIndex((s) => s.id === props.step);
  const fillViewport = props.fillViewport === true;

  return (
    <main
      className={`mx-auto flex w-full flex-col px-6 ${
        fillViewport
          ? "h-dvh max-h-dvh min-h-0 gap-3 overflow-hidden py-4 max-lg:h-auto max-lg:max-h-none max-lg:overflow-y-auto"
          : "flex-1 gap-8 py-12"
      } ${props.className ?? "max-w-4xl"}`}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <Link
          href="/owner"
          className="text-sm text-zinc-400 hover:text-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          ← Owner Mode
        </Link>
        <nav aria-label="New game steps" className="flex gap-2 text-xs">
          {STEPS.map((step, index) => {
            const active = index === stepIndex;
            const done = index < stepIndex;
            return (
              <span
                key={step.id}
                className={`rounded-full px-3 py-1 ${
                  active
                    ? "bg-amber-600/20 font-medium text-amber-400"
                    : done
                      ? "text-zinc-400"
                      : "text-zinc-600"
                }`}
                aria-current={active ? "step" : undefined}
              >
                {index + 1}. {step.label}
              </span>
            );
          })}
        </nav>
      </div>

      <header className="shrink-0 space-y-1">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-500">
          New Game
        </p>
        <h1
          className={`${
            fillViewport ? "text-2xl" : "text-3xl"
          } font-semibold tracking-tight text-zinc-50`}
        >
          {props.title}
        </h1>
        {props.subtitle ? (
          <p
            className={`max-w-2xl text-zinc-400 ${
              fillViewport ? "text-sm" : ""
            }`}
          >
            {props.subtitle}
          </p>
        ) : null}
      </header>

      {fillViewport ? (
        <div className="flex min-h-0 flex-1 flex-col">{props.children}</div>
      ) : (
        props.children
      )}
    </main>
  );
}
