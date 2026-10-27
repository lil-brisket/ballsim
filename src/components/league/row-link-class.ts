import { cn, focusRingClass, linkClass } from "@/components/ui/styles";

/**
 * Team / player entity links that sit in a table cell or list row: a full 44px
 * tap height (the default entity link class is inline text height).
 */
export const rowLinkClass = cn(
  linkClass,
  // -my-2 lets the 44px hit area reach into the cell's py-2 padding, so the
  // row does not grow taller than the link.
  "-my-2 inline-flex min-h-11 items-center",
  focusRingClass,
);

/** Same hit area for links that keep the surrounding text colour. */
export const rowLinkPlainClass = cn(
  // -my-2 lets the 44px hit area reach into the cell's py-2 padding, so the
  // row does not grow taller than the link.
  "-my-2 inline-flex min-h-11 items-center",
  focusRingClass,
);
