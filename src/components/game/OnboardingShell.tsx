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
}) {
  const stepIndex = STEPS.findIndex((s) => s.id === props.step);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="text-sm text-zinc-400 hover:text-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          ← Home
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

      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-500">
          New Game
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
          {props.title}
        </h1>
        {props.subtitle ? (
          <p className="max-w-2xl text-zinc-400">{props.subtitle}</p>
        ) : null}
      </header>

      {props.children}
    </main>
  );
}
