"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/**
 * Link for tabs and menus: prefetches the whole page once the player shows
 * intent (hover, focus, touch) instead of only its loading skeleton.
 *
 * A page that is ready at click time shows at once. Intent ends with the
 * pointer or focus, so a later save change does not re-render every tab that
 * was ever hovered.
 */
export function IntentLink(
  props: Omit<
    ComponentProps<typeof Link>,
    | "prefetch"
    | "onMouseEnter"
    | "onMouseLeave"
    | "onFocus"
    | "onBlur"
    | "onTouchStart"
  >,
) {
  const [intent, setIntent] = useState(false);
  const start = () => setIntent(true);
  const end = () => setIntent(false);
  return (
    <Link
      {...props}
      prefetch={intent ? true : undefined}
      onMouseEnter={start}
      onMouseLeave={end}
      onFocus={start}
      onBlur={end}
      onTouchStart={start}
    />
  );
}
