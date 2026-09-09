"use client";

import Link from "next/link";
import { useEntityDrawer } from "@/components/entity/EntityDrawerProvider";
import { cn, focusRingClass } from "@/components/ui/styles";

const DEFAULT_CLASS = cn(
  "text-amber-400 hover:underline",
  focusRingClass,
);

type StaffEntityLinkProps = {
  saveId: string;
  staffId: string;
  children: React.ReactNode;
  className?: string;
  /** Skip drawer and navigate to the full staff page. */
  preferNavigation?: boolean;
};

/**
 * Staff entity control: opens Staff Drawer by default.
 * Prefer preferNavigation when a full-page jump is required.
 */
export function StaffEntityLink({
  saveId,
  staffId,
  children,
  className,
  preferNavigation = false,
}: StaffEntityLinkProps) {
  const { openStaff } = useEntityDrawer();
  const destination = `/dashboard/${saveId}/staff/${staffId}`;

  if (preferNavigation) {
    return (
      <Link href={destination} className={className ?? DEFAULT_CLASS}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className ?? DEFAULT_CLASS}
      onClick={() => openStaff(staffId)}
    >
      {children}
    </button>
  );
}
