import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { DrawingPoint, DrawingStroke, PdfTextBox, PenTool as PenToolType } from '../../types/notes';
import { renderStrokesToContext } from '../../utils/canvasRender';

const LOGICAL_WIDTH = 900;

function pointToSegmentDist(p: { x: number; y: number }, a: DrawingPoint, b: DrawingPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function segmentIntersectsRect(
  a: { x: number; y: number },
  b: { x: number; y: number },
  rx: number,
  ry: number,
  rw: number,
  rh: number
): boolean {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  if (maxX < rx || minX > rx + rw || maxY < ry || minY > ry + rh) return false;

  const steps = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 5));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = a.x + (b.x - a.x) * t;
    const py = a.y + (b.y - a.y) * t;
    if (px >= rx && px <= rx + rw && py >= ry && py <= ry + rh) {
      return true;
    }
  }
  return false;
}

function getPdfContainRect(canvasW: number, canvasH: number, pdfAspect: number) {
  const canvasAspect = canvasW / Math.max(1, canvasH);
  if (canvasAspect > pdfAspect) {
    const h = canvasH;
    const w = h * pdfAspect;
    return { x: (canvasW - w) / 2, y: 0, w, h };
  }
  const w = canvasW;
  const h = w / Math.max(0.1, pdfAspect);
  return { x: 0, y: (canvasH - h) / 2, w, h };
}

interface LogicalTextRect {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

function buildSnappedPdfHighlights(
  points: DrawingPoint[],
  color: string,
  highlighterWidth: number,
  logicalW: number,
  logicalH: number,
  pdfAspect: number,
  textBoxes: PdfTextBox[]
): DrawingStroke[] {
  if (points.length === 0 || textBoxes.length === 0) return [];

  const pdfRect = getPdfContainRect(logicalW, logicalH, pdfAspect);
  const logicalBoxes: LogicalTextRect[] = textBoxes.map((b) => {
    const x = pdfRect.x + b.x * pdfRect.w;
    const y = pdfRect.y + b.y * pdfRect.h;
    const w = b.w * pdfRect.w;
    const h = b.h * pdfRect.h;
    return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
  });

  const touched = new Set<number>();
  const nibExtraY = Math.max(0, highlighterWidth * 0.28);
  for (let idx = 0; idx < logicalBoxes.length; idx++) {
    const box = logicalBoxes[idx];
    const padX = 8;
    const padY = Math.max(6, box.h * 0.52, nibExtraY);
    const rx = box.x - padX;
    const ry = box.y - padY;
    const rw = box.w + padX * 2;
    const rh = box.h + padY * 2;

    if (points.length === 1) {
      const p = points[0];
      if (p.x >= rx && p.x <= rx + rw && p.y >= ry && p.y <= ry + rh) {
        touched.add(idx);
      }
    } else {
      for (let i = 1; i < points.length; i++) {
        if (segmentIntersectsRect(points[i - 1], points[i], rx, ry, rw, rh)) {
          touched.add(idx);
          break;
        }
      }
    }
  }

  if (touched.size === 0) return [];

  interface LineGroup {
    boxes: LogicalTextRect[];
    cy: number;
    avgH: number;
  }
  const lineGroups: LineGroup[] = [];

  for (const idx of touched) {
    const box = logicalBoxes[idx];
    let targetGroup = lineGroups.find(
      (g) => Math.abs(box.cy - g.cy) <= Math.max(box.h, g.avgH) * 0.65
    );
    if (!targetGroup) {
      targetGroup = { boxes: [], cy: box.cy, avgH: box.h };
      lineGroups.push(targetGroup);
    }
    targetGroup.boxes.push(box);
    targetGroup.cy =
      targetGroup.boxes.reduce((acc, item) => acc + item.cy, 0) / targetGroup.boxes.length;
    targetGroup.avgH =
      targetGroup.boxes.reduce((acc, item) => acc + item.h, 0) / targetGroup.boxes.length;
  }

  lineGroups.sort((a, b) => a.cy - b.cy);

  const now = Date.now();
  return lineGroups.map((group, groupIdx) => {
    let minX = Math.min(...group.boxes.map((b) => b.x));
    let maxX = Math.max(...group.boxes.map((b) => b.x + b.w));

    const sameLineBoxes = logicalBoxes.filter(
      (b) =>
        Math.abs(b.cy - group.cy) <= Math.max(b.h, group.avgH) * 0.65 &&
        b.cx >= minX - 10 &&
        b.cx <= maxX + 10
    );
    if (sameLineBoxes.length > 0) {
      minX = Math.min(...sameLineBoxes.map((b) => b.x));
      maxX = Math.max(...sameLineBoxes.map((b) => b.x + b.w));
      const refinedCy = sameLineBoxes.reduce((acc, b) => acc + b.cy, 0) / sameLineBoxes.length;
      const refinedH = sameLineBoxes.reduce((acc, b) => acc + b.h, 0) / sameLineBoxes.length;
      const strokeWidth = Math.max(8, Math.min(48, Math.round(refinedH * 0.96 * 10) / 10));
      return {
        id: `ink-hl-${now}-${groupIdx}-${Math.random().toString(36).slice(2, 5)}`,
        tool: 'highlighter',
        color,
        width: strokeWidth,
        points: [
          { x: Math.round(minX * 10) / 10, y: Math.round(refinedCy * 10) / 10, pressure: 0.5 },
          { x: Math.round(maxX * 10) / 10, y: Math.round(refinedCy * 10) / 10, pressure: 0.5 },
        ],
      };
    }

    const strokeWidth = Math.max(8, Math.min(48, Math.round(group.avgH * 0.96 * 10) / 10));
    return {
      id: `ink-hl-${now}-${groupIdx}-${Math.random().toString(36).slice(2, 5)}`,
      tool: 'highlighter',
      color,
      width: strokeWidth,
      points: [
        { x: Math.round(minX * 10) / 10, y: Math.round(group.cy * 10) / 10, pressure: 0.5 },
        { x: Math.round(maxX * 10) / 10, y: Math.round(group.cy * 10) / 10, pressure: 0.5 },
      ],
    };
  });
}

export interface PageInkOverlayHandle {
  beginExternalPenStroke: (e: React.PointerEvent<HTMLElement>) => void;
  exportPngDataUrl: () => string;
}

interface PageInkOverlayProps {
  sheetRef: React.RefObject<HTMLDivElement | null>;
  strokes: DrawingStroke[];
  isInkMode: boolean;
  tool: PenToolType;
  color: string;
  strokeWidth: number;
  highlighterWidth?: number;
  eraserWidth?: number;
  isSheetDark?: boolean;
  pdfTextBoxes?: PdfTextBox[];
  pdfAspectRatio?: number;
  onChangeStrokes: (strokes: DrawingStroke[]) => void;
}

export const PageInkOverlay = React.forwardRef<PageInkOverlayHandle, PageInkOverlayProps>(
  (
    {
      sheetRef,
      strokes,
      isInkMode,
      tool,
      color,
      strokeWidth,
      highlighterWidth = 18,
      eraserWidth = 18,
      isSheetDark = false,
      pdfTextBoxes,
      pdfAspectRatio = 210 / 297,
      onChangeStrokes,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [logicalHeight, setLogicalHeight] = useState(760);
    const [isDrawingExternalPen, setIsDrawingExternalPen] = useState(false);

    const isDrawingRef = useRef(false);
    const activePointerIdRef = useRef<number | null>(null);
    const activeStrokeRef = useRef<DrawingStroke | null>(null);
    const rawHighlightPointsRef = useRef<DrawingPoint[]>([]);
    const snappedHighlightStrokesRef = useRef<DrawingStroke[]>([]);
    const strokesRef = useRef(strokes);
    strokesRef.current = strokes;
    const cleanupExternalListenersRef = useRef<(() => void) | null>(null);

    // Prevent browser scroll only when an Apple Pencil / stylus touch starts; finger touch ALWAYS scrolls
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const handleTouchStart = (ev: TouchEvent) => {
        const firstTouch = ev.touches[0] as (Touch & { touchType?: string }) | undefined;
        if (firstTouch?.touchType === 'stylus') {
          ev.preventDefault();
        }
      };
      canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      return () => {
        canvas.removeEventListener('touchstart', handleTouchStart);
      };
    }, []);

    useEffect(() => {
      return () => {
        cleanupExternalListenersRef.current?.();
      };
    }, []);

    // Keep canvas logical height synced to sheet height
    useEffect(() => {
      const sheet = sheetRef.current;
      if (!sheet) return;

      const updateSize = () => {
        const rect = sheet.getBoundingClientRect();
        if (rect.width > 0) {
          const scaledHeight = Math.max(320, Math.round((rect.height / rect.width) * LOGICAL_WIDTH));
          setLogicalHeight(scaledHeight);
        }
      };

      updateSize();
      const observer = new ResizeObserver(updateSize);
      observer.observe(sheet);
      return () => observer.disconnect();
    }, [sheetRef]);

    const redraw = useCallback(
      (extraStrokes?: DrawingStroke[] | null) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const list =
          extraStrokes && extraStrokes.length > 0
            ? [...strokesRef.current, ...extraStrokes]
            : strokesRef.current;
        renderStrokesToContext(ctx, list, LOGICAL_WIDTH, logicalHeight, {
          adaptDarkInk: isSheetDark,
        });
      },
      [logicalHeight, isSheetDark]
    );

    useEffect(() => {
      redraw();
    }, [strokes, logicalHeight, isSheetDark, redraw]);

    const toLogicalPoint = useCallback(
      (clientX: number, clientY: number, pressure: number): DrawingPoint => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const scaleX = LOGICAL_WIDTH / rect.width;
        const scaleY = logicalHeight / rect.height;
        return {
          x: Math.round((clientX - rect.left) * scaleX * 10) / 10,
          y: Math.round((clientY - rect.top) * scaleY * 10) / 10,
          pressure: pressure && pressure > 0 ? pressure : 0.5,
        };
      },
      [logicalHeight]
    );

    const eraseNear = useCallback(
      (pt: DrawingPoint) => {
        const threshold = Math.max(10, eraserWidth);
        const filtered = strokesRef.current.filter((stroke) => {
          if (stroke.points.length === 1) {
            return Math.hypot(pt.x - stroke.points[0].x, pt.y - stroke.points[0].y) > threshold;
          }
          for (let i = 1; i < stroke.points.length; i++) {
            if (pointToSegmentDist(pt, stroke.points[i - 1], stroke.points[i]) <= threshold) {
              return false;
            }
          }
          return true;
        });
        if (filtered.length !== strokesRef.current.length) {
          onChangeStrokes(filtered);
        }
      },
      [onChangeStrokes, eraserWidth]
    );

    const startStrokeAt = useCallback(
      (clientX: number, clientY: number, pressure: number, pointerId: number) => {
        if (!canvasRef.current) return;
        isDrawingRef.current = true;
        activePointerIdRef.current = pointerId;
        canvasRef.current.style.touchAction = 'none';
        const pt = toLogicalPoint(clientX, clientY, pressure);

        if (tool === 'eraser') {
          eraseNear(pt);
          return;
        }

        const newStroke: DrawingStroke = {
          id: `ink-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tool,
          color,
          width: tool === 'highlighter' ? highlighterWidth : strokeWidth,
          points: [pt],
        };
        activeStrokeRef.current = newStroke;

        if (tool === 'highlighter' && pdfTextBoxes && pdfTextBoxes.length > 0) {
          rawHighlightPointsRef.current = [pt];
          const snapped = buildSnappedPdfHighlights(
            rawHighlightPointsRef.current,
            color,
            highlighterWidth,
            LOGICAL_WIDTH,
            logicalHeight,
            pdfAspectRatio,
            pdfTextBoxes
          );
          snappedHighlightStrokesRef.current = snapped;
          redraw(snapped.length > 0 ? snapped : [newStroke]);
          return;
        }

        rawHighlightPointsRef.current = [];
        snappedHighlightStrokesRef.current = [];
        redraw([newStroke]);
      },
      [
        tool,
        color,
        strokeWidth,
        highlighterWidth,
        toLogicalPoint,
        eraseNear,
        redraw,
        pdfTextBoxes,
        logicalHeight,
        pdfAspectRatio,
      ]
    );

    const moveStrokeAt = useCallback(
      (clientX: number, clientY: number, pressure: number, pointerId: number) => {
        if (!isDrawingRef.current || activePointerIdRef.current !== pointerId) return;
        const pt = toLogicalPoint(clientX, clientY, pressure);

        if (tool === 'eraser') {
          eraseNear(pt);
          return;
        }

        if (!activeStrokeRef.current) return;
        const pts = activeStrokeRef.current.points;
        const last = pts[pts.length - 1];
        if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 1.5) return;
        pts.push(pt);

        if (tool === 'highlighter' && pdfTextBoxes && pdfTextBoxes.length > 0) {
          rawHighlightPointsRef.current.push(pt);
          const snapped = buildSnappedPdfHighlights(
            rawHighlightPointsRef.current,
            color,
            highlighterWidth,
            LOGICAL_WIDTH,
            logicalHeight,
            pdfAspectRatio,
            pdfTextBoxes
          );
          snappedHighlightStrokesRef.current = snapped;
          redraw(snapped.length > 0 ? snapped : [activeStrokeRef.current]);
          return;
        }

        redraw([activeStrokeRef.current]);
      },
      [
        tool,
        toLogicalPoint,
        eraseNear,
        redraw,
        pdfTextBoxes,
        color,
        highlighterWidth,
        logicalHeight,
        pdfAspectRatio,
      ]
    );

    const finishStroke = useCallback(
      (pointerId?: number) => {
        if (!isDrawingRef.current) return;
        if (pointerId !== undefined && activePointerIdRef.current !== pointerId) return;

        isDrawingRef.current = false;
        activePointerIdRef.current = null;
        if (canvasRef.current) {
          canvasRef.current.style.touchAction = 'pan-x pan-y';
        }
        cleanupExternalListenersRef.current?.();
        cleanupExternalListenersRef.current = null;
        setIsDrawingExternalPen(false);

        if (tool !== 'eraser' && activeStrokeRef.current) {
          const snapped = snappedHighlightStrokesRef.current;
          const completed = activeStrokeRef.current;
          activeStrokeRef.current = null;
          rawHighlightPointsRef.current = [];
          snappedHighlightStrokesRef.current = [];

          if (tool === 'highlighter' && snapped.length > 0) {
            onChangeStrokes([...strokesRef.current, ...snapped]);
          } else {
            onChangeStrokes([...strokesRef.current, completed]);
          }
        }
      },
      [tool, onChangeStrokes]
    );

    const moveStrokeRef = useRef(moveStrokeAt);
    moveStrokeRef.current = moveStrokeAt;
    const finishStrokeRef = useRef(finishStroke);
    finishStrokeRef.current = finishStroke;

    useImperativeHandle(
      ref,
      () => ({
        beginExternalPenStroke(e: React.PointerEvent<HTMLElement>) {
          if (e.pointerType === 'touch') return;
          cleanupExternalListenersRef.current?.();
          setIsDrawingExternalPen(true);
          const pointerId = e.pointerId;
          startStrokeAt(e.clientX, e.clientY, e.pressure, pointerId);

          const handleWinMove = (ev: PointerEvent) => {
            if (ev.pointerId === pointerId) {
              ev.preventDefault();
              moveStrokeRef.current(ev.clientX, ev.clientY, ev.pressure, ev.pointerId);
            }
          };
          const handleWinUp = (ev: PointerEvent) => {
            if (ev.pointerId === pointerId) {
              finishStrokeRef.current(ev.pointerId);
            }
          };

          window.addEventListener('pointermove', handleWinMove, { passive: false });
          window.addEventListener('pointerup', handleWinUp);
          window.addEventListener('pointercancel', handleWinUp);
          cleanupExternalListenersRef.current = () => {
            window.removeEventListener('pointermove', handleWinMove);
            window.removeEventListener('pointerup', handleWinUp);
            window.removeEventListener('pointercancel', handleWinUp);
          };
        },
        exportPngDataUrl() {
          const offscreen = document.createElement('canvas');
          offscreen.width = LOGICAL_WIDTH;
          offscreen.height = logicalHeight;
          const ctx = offscreen.getContext('2d');
          if (!ctx) return '';
          renderStrokesToContext(ctx, strokesRef.current, LOGICAL_WIDTH, logicalHeight, {
            backgroundColor: '#ffffff',
          });
          return offscreen.toDataURL('image/png');
        },
      }),
      [startStrokeAt, logicalHeight]
    );

    return (
      <canvas
        ref={canvasRef}
        width={LOGICAL_WIDTH}
        height={logicalHeight}
        onPointerDown={(e) => {
          // Finger touch MUST only scroll/move pages; only pen (or desktop mouse) writes/highlights/erases
          if (e.pointerType === 'touch') return;
          if (!isInkMode && e.pointerType !== 'pen') return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          startStrokeAt(e.clientX, e.clientY, e.pressure, e.pointerId);
        }}
        onPointerMove={(e) => {
          if (e.pointerType === 'touch') return;
          if (!isInkMode && e.pointerType !== 'pen') return;
          moveStrokeAt(e.clientX, e.clientY, e.pressure, e.pointerId);
        }}
        onPointerUp={(e) => {
          if (e.pointerType === 'touch') return;
          finishStroke(e.pointerId);
        }}
        onPointerCancel={(e) => {
          if (e.pointerType === 'touch') return;
          finishStroke(e.pointerId);
        }}
        className={`absolute inset-0 z-20 h-full w-full select-none touch-pan-x touch-pan-y ${
          isInkMode
            ? `pointer-events-auto ${
                tool === 'highlighter' && pdfTextBoxes && pdfTextBoxes.length > 0
                  ? 'cursor-text'
                  : 'cursor-crosshair'
              }`
            : isDrawingExternalPen
            ? 'pointer-events-none'
            : 'pointer-events-none'
        }`}
      />
    );
  }
);

PageInkOverlay.displayName = 'PageInkOverlay';
