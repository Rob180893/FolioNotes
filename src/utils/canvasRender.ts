import type { DrawingStroke } from '../types/notes';

function resolveStrokeColor(color: string, adaptDarkInk?: boolean): string {
  if (!adaptDarkInk) return color;
  const normalized = color.trim().toLowerCase();
  if (
    normalized === '#0f172a' ||
    normalized === '#000000' ||
    normalized === '#111827' ||
    normalized === '#1e293b'
  ) {
    return '#F1F5F9';
  }
  return color;
}

export function renderStrokesToContext(
  ctx: CanvasRenderingContext2D,
  strokes: DrawingStroke[],
  width: number,
  height: number,
  options?: { backgroundColor?: string; adaptDarkInk?: boolean }
) {
  ctx.save();
  if (options?.backgroundColor) {
    ctx.fillStyle = options.backgroundColor;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.clearRect(0, 0, width, height);
  }

  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const strokeColor = resolveStrokeColor(stroke.color, options?.adaptDarkInk);

    if (stroke.tool === 'highlighter') {
      const isSnappedLine =
        stroke.points.length === 2 &&
        Math.abs(stroke.points[0].y - stroke.points[1].y) < 1;
      ctx.lineCap = isSnappedLine ? 'butt' : 'round';
      ctx.globalAlpha = 0.36;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = stroke.width;
      drawSmoothPath(ctx, stroke.points);
    } else if (stroke.tool === 'fountain') {
      ctx.globalAlpha = 0.96;
      ctx.strokeStyle = strokeColor;
      ctx.fillStyle = strokeColor;

      if (stroke.points.length === 1) {
        const p = stroke.points[0];
        const r = Math.max(1.2, (stroke.width * (0.6 + p.pressure * 0.8)) / 2);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        for (let i = 1; i < stroke.points.length; i++) {
          const prev = stroke.points[i - 1];
          const curr = stroke.points[i];
          const dx = curr.x - prev.x;
          const dy = curr.y - prev.y;
          const dist = Math.hypot(dx, dy);
          const velocityFactor = Math.max(0.55, Math.min(1.35, 1.25 - dist / 45));
          const pressureFactor = 0.55 + curr.pressure * 0.9;
          ctx.lineWidth = Math.max(1, stroke.width * velocityFactor * pressureFactor);
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(curr.x, curr.y);
          ctx.stroke();
        }
      }
    } else {
      // ballpoint
      ctx.globalAlpha = 0.98;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = stroke.width;
      drawSmoothPath(ctx, stroke.points);
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawSmoothPath(ctx: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>) {
  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

export function exportDrawingToPngDataUrl(
  strokes: DrawingStroke[],
  width = 860,
  height = 320,
  backgroundColor = '#ffffff'
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  renderStrokesToContext(ctx, strokes, width, height, { backgroundColor });
  return canvas.toDataURL('image/png');
}
