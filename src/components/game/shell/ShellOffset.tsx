"use client";

import { useEffect, useRef } from "react";

/**
 * Wraps the sticky shell header and publishes its height as `--shell-offset`
 * on the document, so sticky page elements can sit below it
 * (`top-[calc(var(--shell-offset,0px)+1rem)]`).
 */
export function ShellOffset(props: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const root = document.documentElement;
    const update = () => {
      const sticky = getComputedStyle(node).position === "sticky";
      root.style.setProperty(
        "--shell-offset",
        sticky ? `${node.offsetHeight}px` : "0px",
      );
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      root.style.removeProperty("--shell-offset");
    };
  }, []);

  return (
    <div ref={ref} className={props.className}>
      {props.children}
    </div>
  );
}
