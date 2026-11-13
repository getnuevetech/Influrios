/** Shared popup rules. Closing a record returns to the list without dropping its filters. */

export function isDismissKey(key: string) {
  return key === "Escape";
}

export function nextFocusIndex(count: number, current: number, shift: boolean) {
  if (count <= 0) return -1;
  if (current < 0) return shift ? count - 1 : 0;
  const step = shift ? -1 : 1;
  return (current + step + count) % count;
}

export function nextTabIndex(count: number, current: number, key: string) {
  if (count <= 0) return null;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowRight") return (current + 1) % count;
  if (key === "ArrowLeft") return (current - 1 + count) % count;
  return null;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusableElements(root: ParentNode) {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => {
    if (element.closest("[hidden]")) return false;
    if (element.getAttribute("aria-hidden") === "true") return false;
    return true;
  });
}

/** Drop the open-record keys and keep the list filters. */
export function listReturnQuery(
  query: Record<string, string | undefined>,
  recordKeys: readonly string[],
) {
  const kept: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (!value || recordKeys.includes(key)) continue;
    kept[key] = value;
  }
  return kept;
}
