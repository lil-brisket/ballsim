/**
 * Refcounted body scroll lock shared by every Drawer instance.
 * Nested drawers must not recapture overflow/padding after the first lock.
 */

let lockCount = 0;
let capturedOverflow = "";
let capturedPaddingRight = "";

export function acquireDrawerScrollLock(): void {
  if (typeof document === "undefined") {
    return;
  }
  if (lockCount === 0) {
    capturedOverflow = document.body.style.overflow;
    capturedPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }
  lockCount += 1;
}

export function releaseDrawerScrollLock(): void {
  if (typeof document === "undefined") {
    return;
  }
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = capturedOverflow;
    document.body.style.paddingRight = capturedPaddingRight;
  }
}

/** Test helper so suites do not leak lock count across cases. */
export function resetDrawerScrollLockForTests(): void {
  lockCount = 0;
  capturedOverflow = "";
  capturedPaddingRight = "";
  if (typeof document !== "undefined") {
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
  }
}

export function getDrawerScrollLockCountForTests(): number {
  return lockCount;
}
