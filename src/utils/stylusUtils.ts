export interface StylusPointerLike {
  pointerType: string;
  button: number;
  buttons: number;
}

export interface TouchPalmCandidate {
  pointerType: string;
  pointerId: number;
  width?: number;
  height?: number;
}

/**
 * Detects whether a stylus PointerEvent represents an eraser press:
 * - W3C pen eraser button: button === 5 or (buttons & 32) !== 0
 * - Samsung S Pen / Android barrel secondary button: button === 2 or (buttons & 2) !== 0
 */
export function isStylusEraserEvent(e: StylusPointerLike): boolean {
  if (e.pointerType !== 'pen') return false;
  return (
    (e.buttons & 32) !== 0 ||
    (e.buttons & 2) !== 0 ||
    e.button === 5 ||
    e.button === 2
  );
}

/**
 * Rejects touch contacts that are likely a resting palm/wrist or occur while
 * the stylus is hovering/actively writing nearby.
 */
export function isLikelyPalmTouch(
  e: TouchPalmCandidate,
  penGuardUntilMs: number
): boolean {
  if (e.pointerType !== 'touch') return false;
  if (Date.now() < penGuardUntilMs) return true;
  if ((e.width ?? 0) > 36 || (e.height ?? 0) > 36) return true;
  return false;
}

/**
 * Programmatically pans the nearest editor scroll container when a single clean
 * finger swipes across a touch-none ink surface.
 */
export function scrollEditorByTouchDelta(
  startEl: HTMLElement | null,
  dx: number,
  dy: number
): void {
  if (!startEl || (dx === 0 && dy === 0)) return;

  const explicitEditorScroll = startEl.closest<HTMLElement>('[data-editor-scroll="true"]');
  if (explicitEditorScroll) {
    if (dy !== 0 && explicitEditorScroll.scrollHeight > explicitEditorScroll.clientHeight) {
      explicitEditorScroll.scrollTop -= dy;
    }
    if (dx !== 0 && explicitEditorScroll.scrollWidth > explicitEditorScroll.clientWidth) {
      explicitEditorScroll.scrollLeft -= dx;
    }
    return;
  }

  let current: HTMLElement | null = startEl.parentElement;
  let remainingDx = dx;
  let remainingDy = dy;

  while (current && (remainingDx !== 0 || remainingDy !== 0)) {
    const style = window.getComputedStyle(current);
    const canScrollY =
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      current.scrollHeight > current.clientHeight;
    const canScrollX =
      (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
      current.scrollWidth > current.clientWidth;

    if (canScrollY && remainingDy !== 0) {
      const prev = current.scrollTop;
      current.scrollTop -= remainingDy;
      remainingDy -= prev - current.scrollTop;
    }
    if (canScrollX && remainingDx !== 0) {
      const prev = current.scrollLeft;
      current.scrollLeft -= remainingDx;
      remainingDx -= prev - current.scrollLeft;
    }
    current = current.parentElement;
  }
}
