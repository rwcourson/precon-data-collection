import type { PointerEvent as ReactPointerEvent } from "react";

/** Reorder a column key list by dropping `fromKey` before or after `toKey`. */
export function moveColumnKey(
  keys: string[],
  fromKey: string,
  toKey: string,
  place: "before" | "after",
): string[] {
  if (fromKey === toKey) return keys;
  const from = keys.indexOf(fromKey);
  const to = keys.indexOf(toKey);
  if (from < 0 || to < 0) return keys;
  const next = keys.slice();
  next.splice(from, 1);
  let insert = next.indexOf(toKey);
  if (insert < 0) return keys;
  if (place === "after") insert += 1;
  next.splice(insert, 0, fromKey);
  return next;
}

export function dropPlaceForPoint(clientX: number, rect: DOMRect): "before" | "after" {
  return clientX < rect.left + rect.width / 2 ? "before" : "after";
}

/**
 * 1:1 column resize. Measures the rendered header (so stretched tables don't
 * scale the delta) and captures the pointer so tracking doesn't drop.
 */
export function beginColumnResize(opts: {
  event: ReactPointerEvent<HTMLElement>;
  startWidth: number;
  minWidth?: number;
  onWidth: (width: number) => void;
  onEnd?: () => void;
}): void {
  const { event, startWidth, minWidth = 64, onWidth, onEnd } = opts;
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();

  const handle = event.currentTarget;
  const header = handle.closest("th");
  const originX = event.clientX;
  const originW = header?.getBoundingClientRect().width ?? startWidth;
  const pointerId = event.pointerId;

  try {
    handle.setPointerCapture(pointerId);
  } catch {
    /* Some browsers reject capture if the pointer is already released. */
  }

  const onMove = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    onWidth(Math.max(minWidth, Math.round(originW + (ev.clientX - originX))));
  };
  const onUp = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    handle.removeEventListener("pointermove", onMove);
    handle.removeEventListener("pointerup", onUp);
    handle.removeEventListener("pointercancel", onUp);
    if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    onEnd?.();
  };

  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
  handle.addEventListener("pointermove", onMove);
  handle.addEventListener("pointerup", onUp);
  handle.addEventListener("pointercancel", onUp);
}

export const COLUMN_RESIZE_HANDLE_CLASS =
  "absolute inset-y-0 -right-1 z-20 w-3 cursor-col-resize touch-none hover:bg-primary/40 active:bg-primary/50";
