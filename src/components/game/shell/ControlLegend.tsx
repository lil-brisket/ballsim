import { KeyHint } from "@/components/ui/KeyHint";

/**
 * Desktop footer listing the keys that work everywhere. Hidden on touch
 * screens (KeyHint) and below lg. Only lists keys that are wired up.
 */
export function ControlLegend(props: { hubCount: number }) {
  return (
    <footer
      aria-label="Keyboard controls"
      className="fixed inset-x-0 bottom-0 z-30 hidden border-t border-surface-line bg-surface-deep/90 backdrop-blur lg:block pointer-coarse:hidden"
    >
      <div className="mx-auto flex max-w-[100rem] flex-wrap items-center gap-x-6 gap-y-1 px-6 py-2">
        <KeyHint keys={["Q", "E"]} label="Switch hub" />
        <KeyHint keys={`1–${props.hubCount}`} label="Jump to hub" />
        <KeyHint keys="Tab" label="Move" />
        <KeyHint keys="Enter" label="Select" />
        <KeyHint keys="Esc" label="Close" />
      </div>
    </footer>
  );
}
