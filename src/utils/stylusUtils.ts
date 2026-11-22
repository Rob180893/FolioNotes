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

declare global {
  interface Window {
    __folioNativeStylusEraser?: boolean;
    __folioNativeStylusBridgeActive?: boolean;
  }
}

export function hasNativeStylusBridge(): boolean {
  return typeof window !== 'undefined' && window.__folioNativeStylusBridgeActive === true;
}

/**
 * Detects whether a stylus PointerEvent represents an eraser press:
 * - Native Android MotionEvent bridge flag (TOOL_TYPE_ERASER / BUTTON_STYLUS_PRIMARY / SECONDARY)
 * - W3C pen eraser button: button === 5 or (buttons & 32) !== 0
 * - Secondary stylus barrel button: (buttons & 64) !== 0, (buttons & 2) !== 0, or button === 2
 */
export function isStylusEraserEvent(e: StylusPointerLike): boolean {
  if (e.pointerType !== 'pen') return false;
  const nativeEraser =
    typeof window !== 'undefined' && window.__folioNativeStylusEraser === true;
  return (
    nativeEraser ||
    (e.buttons & 32) !== 0 ||
    (e.buttons & 64) !== 0 ||
    (e.buttons & 2) !== 0 ||
    e.button === 5 ||
    e.button === 2
  );
}

/**
 * Returns true if the stylus barrel/eraser button bit is currently pressed in PointerEvent.buttons.
 */
export function hasStylusBarrelBit(buttons: number): boolean {
  return (buttons & 32) !== 0 || (buttons & 64) !== 0 || (buttons & 2) !== 0;
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
