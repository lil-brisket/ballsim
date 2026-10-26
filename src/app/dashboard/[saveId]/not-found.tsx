import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn, focusRingClass, linkClass } from "@/components/ui/styles";

export default function DashboardNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-6 py-16">
      <SectionHeading as="h1" size="lg" title="Save not found" />
      <p className="text-sm text-muted">
        This save does not exist or could not be loaded. Return home and pick a
        valid save.
      </p>
      <Link href="/home" className={cn(linkClass, "text-sm", focusRingClass)}>
        ← Home
      </Link>
    </main>
  );
}
