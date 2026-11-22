import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Eraser,
  Highlighter,
  Maximize2,
  Minimize2,
  Pen,
  PenTool,
  Redo2,
  ScanText,
  Trash2,
  Undo2,
} from 'lucide-react';
import type { DrawingData, DrawingPoint, DrawingStroke, PenTool as PenToolType } from '../../types/notes';
import { exportDrawingToPngDataUrl, renderStrokesToContext } from '../../utils/canvasRender';
import {
  isLikelyPalmTouch,
  isStylusEraserEvent,
  scrollEditorByTouchDelta,
} from '../../utils/stylusUtils';

interface DrawingCanvasBlockProps {
  drawing: DrawingData;
  caption: string;
  penTool?: PenToolType;
  penColor?: string;
  penWidth?: number;
  isSheetDark?: boolean;
  onChangeDrawing: (drawing: DrawingData) => void;
  onChangeCaption: (caption: string) => void;
  onRunOcr?: (pngDataUrl: string) => void;
  isOcrLoading?: boolean;
}

const PEN_COLORS = [
  { label: 'Preto Tinta', value: '#0F172A' },
  { label: 'Carmim', value: '#DC2626' },
  { label: 'Azul', value: '#2563EB' },
  { label: 'Índigo', value: '#4F46E5' },
  { label: 'Esmeralda', value: '#059669' },
  { label: 'Marca-Texto Amarelo', value: '#FACC15' },
];

const WIDTH_OPTIONS = [
  { label: 'Fino', value: 2 },
  { label: 'Médio', value: 3.5 },
  { label: 'Grosso', value: 6 },
];

function pointToSegmentDist(p: { x: number; y: number }, a: DrawingPoint, b: DrawingPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export const DrawingCanvasBlock: React.FC<DrawingCanvasBlockProps> = ({
  drawing,
  caption,
  penTool: externalTool,
  penColor: externalColor,
  penWidth: externalWidth,
  isSheetDark = false,
  onChangeDrawing,
  onChangeCaption,
  onRunOcr,
  isOcrLoading = false,
}) => {
  const [localTool, setLocalTool] = useState<PenToolType>('fountain');
  const [localColor, setLocalColor] = useState<string>('#0F172A');
  const [localWidth, setLocalWidth] = useState<number>(3);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [redoStack, setRedoStack] = useState<DrawingStroke[]>([]);

  const activeTool = !isFullscreen && externalTool ? externalTool : localTool;
  const activeColor = !isFullscreen && externalColor ? externalColor : localColor;
  const activeWidth = !isFullscreen && externalWidth ? externalWidth : localWidth;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDrawingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const isBarrelEraserRef = useRef(false);
  const activeStrokeRef = useRef<DrawingStroke | null>(null);
  const strokesRef = useRef(drawing.strokes);
  strokesRef.current = drawing.strokes;
  const penGuardUntilRef = useRef(0);
  const fingerScrollRef = useRef<{ pointerId: number; lastX: number; lastY: number } | null>(null);
  const logicalWidth = 840;
  const logicalHeight = isFullscreen ? 540 : drawing.height || 270;

  const redraw = useCallback(
    (extraStroke?: DrawingStroke | null) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const strokesToDraw = extraStroke
        ? [...strokesRef.current, extraStroke]
        : strokesRef.current;
      renderStrokesToContext(ctx, strokesToDraw, logicalWidth, logicalHeight, {
        adaptDarkInk: isSheetDark && !isFullscreen,
      });
    },
    [logicalHeight, isSheetDark, isFullscreen]
  );

  useEffect(() => {
    redraw();
  }, [drawing.strokes, redraw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleTouchPrevent = (ev: TouchEvent) => {
      ev.preventDefault();
    };
    canvas.addEventListener('touchstart', handleTouchPrevent, { passive: false });
    canvas.addEventListener('touchmove', handleTouchPrevent, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', handleTouchPrevent);
      canvas.removeEventListener('touchmove', handleTouchPrevent);
    };
  }, [isFullscreen]);

  const selectTool = (nextTool: PenToolType) => {
    setLocalTool(nextTool);
    if (nextTool === 'highlighter') {
      setLocalColor('#FACC15');
      setLocalWidth(14);
    } else if (localColor === '#FACC15') {
      setLocalColor('#0F172A');
      setLocalWidth(3);
    } else if (nextTool === 'ballpoint' || nextTool === 'fountain') {
      if (localWidth > 10) setLocalWidth(3);
    }
  };

  const toRelativePoint = (clientX: number, clientY: number, pressure: number): DrawingPoint => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = logicalWidth / rect.width;
    const scaleY = logicalHeight / rect.height;
    return {
      x: Math.round((clientX - rect.left) * scaleX * 10) / 10,
      y: Math.round((clientY - rect.top) * scaleY * 10) / 10,
      pressure: pressure && pressure > 0 ? pressure : 0.5,
    };
  };

  const eraseNearPoint = (pt: DrawingPoint) => {
    const threshold = 16;
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
      strokesRef.current = filtered;
      redraw();
      onChangeDrawing({ ...drawing, strokes: filtered });
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'touch') {
      if (
        isLikelyPalmTouch(e, penGuardUntilRef.current) ||
        isDrawingRef.current ||
        fingerScrollRef.current !== null
      ) {
        return;
      }
      fingerScrollRef.current = {
        pointerId: e.pointerId,
        lastX: e.clientX,
        lastY: e.clientY,
      };
      return;
    }

    if (e.pointerType === 'mouse' && e.button !== 0) return;

    penGuardUntilRef.current = Date.now() + 900;
    fingerScrollRef.current = null;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic capture failures
    }

    isDrawingRef.current = true;
    activePointerIdRef.current = e.pointerId;
    const forceEraser = isStylusEraserEvent(e);
    isBarrelEraserRef.current = forceEraser;
    const pt = toRelativePoint(e.clientX, e.clientY, e.pressure);

    if (activeTool === 'eraser' || forceEraser) {
      eraseNearPoint(pt);
      return;
    }

    const newStroke: DrawingStroke = {
      id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tool: activeTool,
      color: activeColor,
      width: activeTool === 'highlighter' ? Math.max(14, activeWidth) : activeWidth,
      points: [pt],
    };
    activeStrokeRef.current = newStroke;
    redraw(newStroke);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'pen') {
      penGuardUntilRef.current = Date.now() + 800;
    }

    if (e.pointerType === 'touch') {
      const currentPan = fingerScrollRef.current;
      if (!currentPan || currentPan.pointerId !== e.pointerId) return;
      if (isLikelyPalmTouch(e, penGuardUntilRef.current) || isDrawingRef.current) {
        fingerScrollRef.current = null;
        return;
      }
      const dx = e.clientX - currentPan.lastX;
      const dy = e.clientY - currentPan.lastY;
      currentPan.lastX = e.clientX;
      currentPan.lastY = e.clientY;
      scrollEditorByTouchDelta(e.currentTarget, dx, dy);
      return;
    }

    if (!isDrawingRef.current || activePointerIdRef.current !== e.pointerId) return;
    penGuardUntilRef.current = Date.now() + 900;

    const nativeEv = e.nativeEvent;
    const coalesced =
      typeof nativeEv.getCoalescedEvents === 'function' ? nativeEv.getCoalescedEvents() : null;
    const samples = coalesced && coalesced.length > 0 ? coalesced : [nativeEv];

    for (const sample of samples) {
      const forceEraser = isStylusEraserEvent(sample);
      const pt = toRelativePoint(sample.clientX, sample.clientY, sample.pressure);

      if (forceEraser && !isBarrelEraserRef.current) {
        isBarrelEraserRef.current = true;
        activeStrokeRef.current = null;
        redraw();
      }

      if (activeTool === 'eraser' || isBarrelEraserRef.current || forceEraser) {
        eraseNearPoint(pt);
        continue;
      }

      if (!activeStrokeRef.current) continue;
      const pts = activeStrokeRef.current.points;
      const last = pts[pts.length - 1];
      if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 1.5) continue;
      pts.push(pt);
      redraw(activeStrokeRef.current);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'touch') {
      if (fingerScrollRef.current?.pointerId === e.pointerId) {
        fingerScrollRef.current = null;
      }
      return;
    }
    if (!isDrawingRef.current || activePointerIdRef.current !== e.pointerId) return;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore capture release failures
    }

    const wasEraser = activeTool === 'eraser' || isBarrelEraserRef.current;
    isDrawingRef.current = false;
    activePointerIdRef.current = null;
    isBarrelEraserRef.current = false;
    penGuardUntilRef.current = Date.now() + 700;

    if (!wasEraser && activeStrokeRef.current) {
      const completed = activeStrokeRef.current;
      activeStrokeRef.current = null;
      setRedoStack([]);
      onChangeDrawing({
        ...drawing,
        strokes: [...strokesRef.current, completed],
      });
    } else {
      activeStrokeRef.current = null;
    }
  };

  const handleUndo = () => {
    if (drawing.strokes.length === 0) return;
    const last = drawing.strokes[drawing.strokes.length - 1];
    setRedoStack((prev) => [...prev, last]);
    onChangeDrawing({
      ...drawing,
      strokes: drawing.strokes.slice(0, -1),
    });
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const restored = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    onChangeDrawing({
      ...drawing,
      strokes: [...drawing.strokes, restored],
    });
  };

  const handleClear = () => {
    if (drawing.strokes.length === 0) return;
    setRedoStack([]);
    onChangeDrawing({ ...drawing, strokes: [] });
  };

  const handleTriggerOcr = () => {
    if (!onRunOcr || drawing.strokes.length === 0) return;
    const pngDataUrl = exportDrawingToPngDataUrl(drawing.strokes, logicalWidth, logicalHeight, '#ffffff');
    if (pngDataUrl) {
      onRunOcr(pngDataUrl);
    }
  };

  const fullscreenToolbar = (
    <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-700/80 bg-slate-50/90 dark:bg-slate-800/70 px-3 py-2">
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => selectTool('ballpoint')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            localTool === 'ballpoint'
              ? 'bg-slate-900 text-white dark:bg-indigo-600'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/60'
          }`}
        >
          <Pen className="w-3.5 h-3.5" />
          <span>Esferográfica</span>
        </button>

        <button
          type="button"
          onClick={() => selectTool('fountain')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            localTool === 'fountain'
              ? 'bg-slate-900 text-white dark:bg-indigo-600'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/60'
          }`}
        >
          <PenTool className="w-3.5 h-3.5" />
          <span>Tinteiro</span>
        </button>

        <button
          type="button"
          onClick={() => selectTool('highlighter')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            localTool === 'highlighter'
              ? 'bg-amber-400 text-slate-950'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/60'
          }`}
        >
          <Highlighter className="w-3.5 h-3.5" />
          <span>Marca-texto</span>
        </button>

        <button
          type="button"
          onClick={() => selectTool('eraser')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            localTool === 'eraser'
              ? 'bg-rose-600 text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/60'
          }`}
        >
          <Eraser className="w-3.5 h-3.5" />
          <span>Borracha</span>
        </button>

        <div className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-700" />

        <div className="flex items-center gap-1 px-1">
          {PEN_COLORS.map((swatch) => (
            <button
              key={swatch.value}
              type="button"
              onClick={() => {
                setLocalColor(swatch.value);
                if (localTool === 'eraser') setLocalTool('fountain');
              }}
              aria-label={swatch.label}
              title={swatch.label}
              className={`h-5 w-5 rounded-full border transition-transform cursor-pointer ${
                localColor === swatch.value && localTool !== 'eraser'
                  ? 'scale-110 ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900 border-white'
                  : 'border-slate-300 dark:border-slate-600 hover:scale-105'
              }`}
              style={{ backgroundColor: swatch.value }}
            />
          ))}
        </div>

        {localTool !== 'highlighter' && localTool !== 'eraser' && (
          <div className="hidden md:flex items-center gap-0.5 pl-1">
            {WIDTH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLocalWidth(opt.value)}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  localWidth === opt.value
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleUndo}
          disabled={drawing.strokes.length === 0}
          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/60 disabled:opacity-35 cursor-pointer"
          title="Desfazer traço"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleRedo}
          disabled={redoStack.length === 0}
          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/60 disabled:opacity-35 cursor-pointer"
          title="Refazer traço"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={drawing.strokes.length === 0}
          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-rose-600 disabled:opacity-35 cursor-pointer"
          title="Limpar quadro"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        {onRunOcr && (
          <button
            type="button"
            onClick={handleTriggerOcr}
            disabled={drawing.strokes.length === 0 || isOcrLoading}
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40 cursor-pointer"
          >
            <ScanText className="w-3.5 h-3.5" />
            <span>{isOcrLoading ? 'Lendo...' : 'OCR IA'}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setIsFullscreen(false)}
          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/60 cursor-pointer"
          title="Sair da tela cheia"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const canvasElement = (
    <div
      ref={containerRef}
      className={`relative w-full ${isFullscreen ? 'bg-white' : 'bg-transparent'}`}
    >
      <canvas
        ref={canvasRef}
        width={logicalWidth}
        height={logicalHeight}
        onContextMenu={(e) => e.preventDefault()}
        onPointerEnter={(e) => {
          if (e.pointerType === 'pen') {
            penGuardUntilRef.current = Date.now() + 800;
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="w-full h-auto block touch-none cursor-crosshair select-none"
      />
      {drawing.strokes.length === 0 && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs"
          style={{ color: isFullscreen ? '#94a3b8' : 'var(--sheet-placeholder)' }}
        >
          Use as ferramentas de caneta fixas acima para desenhar aqui
        </div>
      )}
    </div>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/75 backdrop-blur-sm p-3 sm:p-6">
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
          {fullscreenToolbar}
          <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-950">
            <div className="w-full max-w-4xl overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              {canvasElement}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group/drawing relative overflow-hidden rounded-xl border transition-colors"
      style={{ borderColor: 'var(--sheet-border)', backgroundColor: 'transparent' }}
    >
      {/* Subtle hover-only quick controls (pen tools remain fixed in the top bar) */}
      <div
        className="no-print absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-lg border px-1 py-0.5 opacity-0 group-hover/drawing:opacity-100 focus-within:opacity-100 transition-opacity backdrop-blur-xs"
        style={{
          borderColor: 'var(--sheet-border)',
          backgroundColor: 'var(--sheet-surface)',
          color: 'var(--sheet-ink-muted)',
        }}
      >
        <button
          type="button"
          onClick={handleUndo}
          disabled={drawing.strokes.length === 0}
          className="p-1 rounded hover:opacity-80 disabled:opacity-30 cursor-pointer"
          title="Desfazer traço"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleRedo}
          disabled={redoStack.length === 0}
          className="p-1 rounded hover:opacity-80 disabled:opacity-30 cursor-pointer"
          title="Refazer traço"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={drawing.strokes.length === 0}
          className="p-1 rounded hover:text-rose-500 disabled:opacity-30 cursor-pointer"
          title="Limpar quadro"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        {onRunOcr && drawing.strokes.length > 0 && (
          <button
            type="button"
            onClick={handleTriggerOcr}
            disabled={isOcrLoading}
            className="inline-flex items-center gap-1 rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-indigo-700 disabled:opacity-40 cursor-pointer"
            title="Converter desenho em texto (OCR IA)"
          >
            <ScanText className="w-3 h-3" />
            <span>{isOcrLoading ? '...' : 'OCR'}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setIsFullscreen(true)}
          className="p-1 rounded hover:opacity-80 cursor-pointer"
          title="Expandir em tela cheia"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {canvasElement}

      <div
        className="border-t px-3 py-1.5"
        style={{ borderColor: 'var(--sheet-border)' }}
      >
        <input
          type="text"
          value={caption}
          onChange={(e) => onChangeCaption(e.target.value)}
          placeholder="Adicionar legenda ao rascunho..."
          className="w-full bg-transparent text-xs focus:outline-none placeholder:text-[var(--sheet-placeholder)]"
          style={{ color: 'var(--sheet-ink-muted)' }}
        />
      </div>
    </div>
  );
};
