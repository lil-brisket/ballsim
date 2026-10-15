import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";

export type OnboardingStep = "mode" | "setup" | "advanced" | "franchise";

const STEPS: { id: OnboardingStep; label: string; href: string }[] = [
  { id: "mode", label: "Mode", href: "/home" },
  { id: "setup", label: "Setup", href: "/new/setup?mode=owner" },
  { id: "advanced", label: "Advanced", href: "" },
  { id: "franchise", label: "Franchise", href: "" },
];

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500";

export function OnboardingSteps(props: {
  step: OnboardingStep;
  /** Makes a non-active step a button (client-controlled steps). */
  onSelect?: Partial<Record<OnboardingStep, () => void>>;
}) {
  const stepIndex = STEPS.findIndex((s) => s.id === props.step);
  return (
    <nav
      aria-label="New game steps"
      className="flex flex-wrap gap-2 font-display text-sm uppercase tracking-wide"
    >
      {STEPS.map((step, index) => {
        const active = index === stepIndex;
        const done = index < stepIndex;
        const label = `${index + 1}. ${step.label}`;
        const select = props.onSelect?.[step.id];
        const className = `inline-flex min-h-11 items-center rounded-full border px-3 py-1 ${
          active
            ? "border-team-ink bg-team font-bold text-on-team"
            : done || select
              ? `border-surface-line text-zinc-200 hover:border-team-ink hover:text-team-ink ${focusRing}`
              : "border-transparent text-zinc-500"
        }`;

        if (!active && select) {
          return (
            <button
              key={step.id}
              type="button"
              onClick={select}
              className={className}
            >
              {label}
            </button>
          );
        }

        if (done && step.href) {
          return (
            <Link key={step.id} href={step.href} className={className}>
              {label}
            </Link>
          );
        }

        return (
          <span
            key={step.id}
            className={className}
            aria-current={active ? "step" : undefined}
          >
            {label}
          </span>
        );
      })}
    </nav>
  );
}

export function OnboardingShell(props: {
  step: OnboardingStep;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  fillViewport?: boolean;
  /** Replaces the default step nav (used by client-controlled flows). */
  steps?: React.ReactNode;
}) {
  const fillViewport = props.fillViewport === true;

  return (
    <main
      className={`mx-auto flex w-full flex-col px-6 ${
        fillViewport
          ? "h-dvh max-h-dvh min-h-0 gap-3 overflow-hidden py-4"
          : "flex-1 gap-8 py-12"
      } ${props.className ?? "max-w-4xl"}`}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <Link
          href="/owner"
          className={`inline-flex min-h-11 items-center text-sm text-zinc-300 hover:text-team-ink ${focusRing}`}
        >
          ← Owner Mode
        </Link>
        {props.steps ?? <OnboardingSteps step={props.step} />}
      </div>

      <header
        id="onboarding-header"
        tabIndex={-1}
        className="shrink-0 space-y-2 outline-none"
      >
        <SectionHeading
          as="h1"
          size={fillViewport ? "md" : "lg"}
          eyebrow="New Game"
          title={props.title}
        />
        {props.subtitle ? (
          <p
            className={`max-w-2xl text-zinc-300 ${
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
