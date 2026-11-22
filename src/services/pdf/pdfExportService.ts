import {
  appendBezierCurve,
  endMarkedContent,
  lineTo,
  LineCapStyle,
  LineJoinStyle,
  moveTo,
  PDFDict,
  PDFDocument,
  PDFFont,
  PDFHexString,
  PDFName,
  PDFOperator,
  PDFOperatorNames,
  PDFPage,
  PDFRef,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  setGraphicsState,
  setLineCap,
  setLineJoin,
  setLineWidth,
  setStrokingRgbColor,
  StandardFonts,
  stroke,
} from 'pdf-lib';
import {
  DEFAULT_PAGE_FORMAT,
  PAGE_COLOR_SWATCHES,
  type DrawingPoint,
  type DrawingStroke,
  type NoteBlock,
  type NotePage,
  type ThemeMode,
} from '../../types/notes';
import { loadPdfBinary } from './pdfBinaryStore';
import { getPdfPageProxy } from './pdfImportService';

const MM_TO_PT = 72 / 25.4;
const INK_LOGICAL_WIDTH = 900;

interface RGB01 {
  r: number;
  g: number;
  b: number;
}

function hexToRgb01(hex: string): RGB01 {
  const clean = hex.trim().replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) / 255;
    const g = parseInt(clean[1] + clean[1], 16) / 255;
    const b = parseInt(clean[2] + clean[2], 16) / 255;
    return {
      r: Number.isFinite(r) ? r : 0.06,
      g: Number.isFinite(g) ? g : 0.09,
      b: Number.isFinite(b) ? b : 0.16,
    };
  }
  if (clean.length >= 6) {
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    return {
      r: Number.isFinite(r) ? r : 0.06,
      g: Number.isFinite(g) ? g : 0.09,
      b: Number.isFinite(b) ? b : 0.16,
    };
  }
  return { r: 0.06, g: 0.09, b: 0.16 };
}

function resolveStrokeColor(color: string, adaptDarkInk: boolean): string {
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

function sanitizePdfText(raw: string): string {
  const replaced = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, '  ')
    .replace(/[\u2022\u25CF\u25E6]/g, '-')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u2192/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/[\u2611\u2713\u2714]/g, '[x]')
    .replace(/\u2610/g, '[ ]');

  // Keep only WinAnsi-safe ASCII + Latin-1 characters (0x20-0x7E, 0xA0-0xFF, plus \n)
  let out = '';
  for (let i = 0; i < replaced.length; i++) {
    const code = replaced.charCodeAt(i);
    if (code === 10 || (code >= 32 && code <= 126) || (code >= 160 && code <= 255)) {
      out += replaced[i];
    }
  }
  return out;
}

function wrapTextLines(
  rawText: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const safe = sanitizePdfText(rawText);
  const paragraphs = safe.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (para.trim() === '') {
      lines.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        currentLine = candidate;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = '';
        }
        if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
          currentLine = word;
        } else {
          // Break very long tokens (e.g. URLs) character by character
          let chunk = '';
          for (const ch of word) {
            if (font.widthOfTextAtSize(chunk + ch, fontSize) <= maxWidth) {
              chunk += ch;
            } else {
              if (chunk) lines.push(chunk);
              chunk = ch;
            }
          }
          currentLine = chunk;
        }
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines.length > 0 ? lines : [''];
}

function getPdfContainRect(boxW: number, boxH: number, aspect: number) {
  const containerAspect = boxW / Math.max(1, boxH);
  if (containerAspect > aspect) {
    const h = boxH;
    const w = h * aspect;
    return { x: (boxW - w) / 2, y: 0, w, h };
  }
  const w = boxW;
  const h = w / Math.max(0.1, aspect);
  return { x: 0, y: (boxH - h) / 2, w, h };
}

function beginLayerOp(layerResourceKey: string): PDFOperator {
  return PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence, [
    PDFName.of('OC'),
    PDFName.of(layerResourceKey),
  ]);
}

function dataUrlToBytes(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  try {
    const [header, b64] = dataUrl.split(',');
    if (!header || !b64) return null;
    const mimeMatch = header.match(/data:([^;]+);base64/i);
    const mime = mimeMatch ? mimeMatch[1].toLowerCase() : 'image/png';
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return { mime, bytes };
  } catch {
    return null;
  }
}

async function rasterizeImageDataUrlToPng(dataUrl: string): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 800;
        canvas.height = img.naturalHeight || 600;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const pngUrl = canvas.toDataURL('image/png');
        resolve(dataUrlToBytes(pngUrl)?.bytes ?? null);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

async function embedImageFromDataUrl(doc: PDFDocument, dataUrl: string) {
  const parsed = dataUrlToBytes(dataUrl);
  if (!parsed) return null;
  try {
    if (parsed.mime === 'image/png') {
      return await doc.embedPng(parsed.bytes);
    }
    if (parsed.mime === 'image/jpeg' || parsed.mime === 'image/jpg') {
      return await doc.embedJpg(parsed.bytes);
    }
  } catch {
    // fallback to canvas conversion
  }
  const pngBytes = await rasterizeImageDataUrlToPng(dataUrl);
  if (!pngBytes) return null;
  return await doc.embedPng(pngBytes);
}

async function renderPdfPageFallbackPng(pdfId: string, pageNumber: number) {
  const proxy = await getPdfPageProxy(pdfId, pageNumber);
  if (!proxy) return null;
  try {
    const viewport = proxy.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await proxy.render({
      canvas,
      canvasContext: ctx,
      viewport,
      background: 'rgb(255, 255, 255)',
    }).promise;
    const parsed = dataUrlToBytes(canvas.toDataURL('image/png'));
    return parsed?.bytes ?? null;
  } finally {
    proxy.cleanup();
  }
}

interface DrawingBoxPlacement {
  strokes: DrawingStroke[];
  x: number;
  yTop: number;
  w: number;
  h: number;
  logicalW: number;
  logicalH: number;
}

interface EmbeddedImageItem {
  blockId: string;
  image: Awaited<ReturnType<typeof PDFDocument.prototype.embedPng>>;
  drawW: number;
  drawH: number;
}

function drawVectorStrokeList(
  page: PDFPage,
  strokes: DrawingStroke[],
  options: {
    originX: number;
    originTopY: number;
    targetW: number;
    targetH: number;
    logicalW: number;
    logicalH: number;
    pdfPageH: number;
    adaptDarkInk: boolean;
    hlGraphicsStateKey?: PDFName;
  }
) {
  const {
    originX,
    originTopY,
    targetW,
    targetH,
    logicalW,
    logicalH,
    pdfPageH,
    adaptDarkInk,
    hlGraphicsStateKey,
  } = options;

  const scaleX = targetW / Math.max(1, logicalW);
  const scaleY = targetH / Math.max(1, logicalH);
  const widthScale = (scaleX + scaleY) / 2;

  const mapPt = (pt: DrawingPoint) => ({
    x: originX + pt.x * scaleX,
    y: pdfPageH - (originTopY + pt.y * scaleY),
  });

  const drawSmoothPolyline = (pts: DrawingPoint[], strokeW: number, capStyle: LineCapStyle, c: RGB01) => {
    if (pts.length === 0) return;

    if (pts.length === 1) {
      const p = mapPt(pts[0]);
      page.drawCircle({
        x: p.x,
        y: p.y,
        size: Math.max(0.6, strokeW / 2),
        color: rgb(c.r, c.g, c.b),
      });
      return;
    }

    const mapped = pts.map(mapPt);
    const ops: PDFOperator[] = [
      setLineCap(capStyle),
      setLineJoin(LineJoinStyle.Round),
      setLineWidth(Math.max(0.5, strokeW)),
      setStrokingRgbColor(c.r, c.g, c.b),
      moveTo(mapped[0].x, mapped[0].y),
    ];

    let cur = mapped[0];
    for (let i = 1; i < mapped.length - 1; i++) {
      const cp = mapped[i];
      const next = mapped[i + 1];
      const mid = { x: (cp.x + next.x) / 2, y: (cp.y + next.y) / 2 };
      // Exact quadratic-to-cubic degree elevation
      const c1x = cur.x + (2 / 3) * (cp.x - cur.x);
      const c1y = cur.y + (2 / 3) * (cp.y - cur.y);
      const c2x = mid.x + (2 / 3) * (cp.x - mid.x);
      const c2y = mid.y + (2 / 3) * (cp.y - mid.y);
      ops.push(appendBezierCurve(c1x, c1y, c2x, c2y, mid.x, mid.y));
      cur = mid;
    }

    const last = mapped[mapped.length - 1];
    ops.push(lineTo(last.x, last.y));
    ops.push(stroke());
    page.pushOperators(...ops);
  };

  for (const s of strokes) {
    if (s.points.length === 0) continue;
    const resolvedHex = resolveStrokeColor(s.color, adaptDarkInk);
    const c = hexToRgb01(resolvedHex);

    page.pushOperators(pushGraphicsState());

    if (s.tool === 'highlighter') {
      if (hlGraphicsStateKey) {
        page.pushOperators(setGraphicsState(hlGraphicsStateKey));
      }
      const isSnappedLine =
        s.points.length === 2 && Math.abs(s.points[0].y - s.points[1].y) < 1;
      drawSmoothPolyline(
        s.points,
        s.width * widthScale,
        isSnappedLine ? LineCapStyle.Butt : LineCapStyle.Round,
        c
      );
    } else if (s.tool === 'fountain') {
      if (s.points.length === 1) {
        const p = mapPt(s.points[0]);
        const r = Math.max(0.8, (s.width * widthScale * (0.6 + s.points[0].pressure * 0.8)) / 2);
        page.drawCircle({
          x: p.x,
          y: p.y,
          size: r,
          color: rgb(c.r, c.g, c.b),
          opacity: 0.96,
        });
      } else {
        const ops: PDFOperator[] = [
          setLineCap(LineCapStyle.Round),
          setLineJoin(LineJoinStyle.Round),
          setStrokingRgbColor(c.r, c.g, c.b),
        ];
        for (let i = 1; i < s.points.length; i++) {
          const prev = s.points[i - 1];
          const curr = s.points[i];
          const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
          const velocityFactor = Math.max(0.55, Math.min(1.35, 1.25 - dist / 45));
          const pressureFactor = 0.55 + curr.pressure * 0.9;
          const segWidth = Math.max(0.6, s.width * widthScale * velocityFactor * pressureFactor);
          const p0 = mapPt(prev);
          const p1 = mapPt(curr);
          ops.push(setLineWidth(segWidth), moveTo(p0.x, p0.y), lineTo(p1.x, p1.y), stroke());
        }
        page.pushOperators(...ops);
      }
    } else {
      // ballpoint
      drawSmoothPolyline(s.points, s.width * widthScale, LineCapStyle.Round, c);
    }

    page.pushOperators(popGraphicsState());
  }
}

function measureAndDrawBlocks(
  mode: 'measure' | 'draw',
  params: {
    page: PDFPage | null;
    notePage: NotePage;
    pdfW: number;
    pdfH: number;
    paddingX: number;
    paddingTop: number;
    contentW: number;
    isSheetDark: boolean;
    fonts: { regular: PDFFont; bold: PDFFont; italic: PDFFont; mono: PDFFont };
    imagesMap: Map<string, EmbeddedImageItem>;
  }
): { totalHeight: number; drawingBoxes: DrawingBoxPlacement[] } {
  const { page, notePage, pdfH, paddingX, paddingTop, contentW, isSheetDark, fonts, imagesMap } =
    params;

  const inkRgb = isSheetDark ? hexToRgb01('#F1F5F9') : hexToRgb01('#0F172A');
  const mutedRgb = isSheetDark ? hexToRgb01('#94A3B8') : hexToRgb01('#64748B');
  const accentRgb = isSheetDark ? hexToRgb01('#818CF8') : hexToRgb01('#4F46E5');
  const surfaceRgb = isSheetDark ? hexToRgb01('#1E293B') : hexToRgb01('#F1F5F9');
  const borderRgb = isSheetDark ? hexToRgb01('#334155') : hexToRgb01('#CBD5E1');
  const calloutFillRgb = isSheetDark ? hexToRgb01('#1E1B4B') : hexToRgb01('#EEF2FF');
  const codeFillRgb = isSheetDark ? hexToRgb01('#0F172A') : hexToRgb01('#F1F5F9');

  let cursorTop = paddingTop;
  const drawingBoxes: DrawingBoxPlacement[] = [];

  const toPdfY = (topY: number) => pdfH - topY;

  // Optional Title
  if (!notePage.hideTitle && notePage.title.trim()) {
    const titleSize = 21;
    const titleLineH = 27;
    const titleLines = wrapTextLines(notePage.title, fonts.bold, titleSize, contentW);
    for (const line of titleLines) {
      if (mode === 'draw' && page && line) {
        page.drawText(line, {
          x: paddingX,
          y: toPdfY(cursorTop + titleSize),
          size: titleSize,
          font: fonts.bold,
          color: rgb(inkRgb.r, inkRgb.g, inkRgb.b),
        });
      }
      cursorTop += titleLineH;
    }
    cursorTop += 10;
  }

  let numberedCounter = 0;

  for (const block of notePage.blocks) {
    if (block.type === 'numbered') {
      numberedCounter += 1;
    } else {
      numberedCounter = 0;
    }

    switch (block.type) {
      case 'h1':
      case 'h2':
      case 'h3': {
        const size = block.type === 'h1' ? 17 : block.type === 'h2' ? 14 : 11.8;
        const lineH = Math.round(size * 1.38);
        cursorTop += block.type === 'h1' ? 8 : 5;
        const lines = wrapTextLines(block.content || '', fonts.bold, size, contentW);
        for (const line of lines) {
          if (mode === 'draw' && page && line) {
            page.drawText(line, {
              x: paddingX,
              y: toPdfY(cursorTop + size),
              size,
              font: fonts.bold,
              color: rgb(inkRgb.r, inkRgb.g, inkRgb.b),
            });
          }
          cursorTop += lineH;
        }
        cursorTop += 5;
        break;
      }

      case 'paragraph': {
        const size = 10.5;
        const lineH = 16;
        if (!block.content.trim()) {
          cursorTop += 12;
          break;
        }
        const lines = wrapTextLines(block.content, fonts.regular, size, contentW);
        for (const line of lines) {
          if (mode === 'draw' && page && line) {
            page.drawText(line, {
              x: paddingX,
              y: toPdfY(cursorTop + size),
              size,
              font: fonts.regular,
              color: rgb(inkRgb.r, inkRgb.g, inkRgb.b),
            });
          }
          cursorTop += lineH;
        }
        cursorTop += 5;
        break;
      }

      case 'bullet':
      case 'numbered': {
        const size = 10.5;
        const lineH = 16;
        const indent = 18;
        const lines = wrapTextLines(block.content || '', fonts.regular, size, contentW - indent);
        if (mode === 'draw' && page) {
          if (block.type === 'bullet') {
            page.drawCircle({
              x: paddingX + 6,
              y: toPdfY(cursorTop + size * 0.65),
              size: 2,
              color: rgb(inkRgb.r, inkRgb.g, inkRgb.b),
            });
          } else {
            page.drawText(`${numberedCounter}.`, {
              x: paddingX + 2,
              y: toPdfY(cursorTop + size),
              size,
              font: fonts.bold,
              color: rgb(mutedRgb.r, mutedRgb.g, mutedRgb.b),
            });
          }
        }
        for (const line of lines) {
          if (mode === 'draw' && page && line) {
            page.drawText(line, {
              x: paddingX + indent,
              y: toPdfY(cursorTop + size),
              size,
              font: fonts.regular,
              color: rgb(inkRgb.r, inkRgb.g, inkRgb.b),
            });
          }
          cursorTop += lineH;
        }
        cursorTop += 3;
        break;
      }

      case 'checklist': {
        const size = 10.5;
        const lineH = 16;
        const indent = 20;
        const lines = wrapTextLines(block.content || '', fonts.regular, size, contentW - indent);
        if (mode === 'draw' && page) {
          const boxSize = 9.5;
          const boxX = paddingX + 2;
          const boxY = toPdfY(cursorTop + boxSize + 1.5);
          if (block.checked) {
            page.drawRectangle({
              x: boxX,
              y: boxY,
              width: boxSize,
              height: boxSize,
              color: rgb(accentRgb.r, accentRgb.g, accentRgb.b),
              borderWidth: 0,
            });
            // Checkmark vector lines
            page.drawLine({
              start: { x: boxX + 2, y: boxY + 4.5 },
              end: { x: boxX + 4, y: boxY + 2.5 },
              thickness: 1.3,
              color: rgb(1, 1, 1),
            });
            page.drawLine({
              start: { x: boxX + 4, y: boxY + 2.5 },
              end: { x: boxX + 7.5, y: boxY + 7 },
              thickness: 1.3,
              color: rgb(1, 1, 1),
            });
          } else {
            page.drawRectangle({
              x: boxX,
              y: boxY,
              width: boxSize,
              height: boxSize,
              borderColor: rgb(mutedRgb.r, mutedRgb.g, mutedRgb.b),
              borderWidth: 1,
            });
          }
        }
        const textColor = block.checked ? mutedRgb : inkRgb;
        for (const line of lines) {
          if (mode === 'draw' && page && line) {
            const textY = toPdfY(cursorTop + size);
            page.drawText(line, {
              x: paddingX + indent,
              y: textY,
              size,
              font: fonts.regular,
              color: rgb(textColor.r, textColor.g, textColor.b),
            });
            if (block.checked) {
              const lw = fonts.regular.widthOfTextAtSize(line, size);
              page.drawLine({
                start: { x: paddingX + indent, y: textY + size * 0.32 },
                end: { x: paddingX + indent + lw, y: textY + size * 0.32 },
                thickness: 0.7,
                color: rgb(mutedRgb.r, mutedRgb.g, mutedRgb.b),
              });
            }
          }
          cursorTop += lineH;
        }
        cursorTop += 4;
        break;
      }

      case 'quote': {
        const size = 10.5;
        const lineH = 16;
        const indent = 16;
        const lines = wrapTextLines(block.content || '', fonts.italic, size, contentW - indent);
        const totalH = lines.length * lineH;
        if (mode === 'draw' && page) {
          page.drawRectangle({
            x: paddingX + 2,
            y: toPdfY(cursorTop + totalH),
            width: 2.5,
            height: totalH,
            color: rgb(accentRgb.r, accentRgb.g, accentRgb.b),
          });
        }
        for (const line of lines) {
          if (mode === 'draw' && page && line) {
            page.drawText(line, {
              x: paddingX + indent,
              y: toPdfY(cursorTop + size),
              size,
              font: fonts.italic,
              color: rgb(mutedRgb.r, mutedRgb.g, mutedRgb.b),
            });
          }
          cursorTop += lineH;
        }
        cursorTop += 6;
        break;
      }

      case 'callout': {
        const size = 10;
        const lineH = 15;
        const boxPad = 10;
        const lines = wrapTextLines(block.content || '', fonts.regular, size, contentW - boxPad * 2);
        const boxH = lines.length * lineH + boxPad * 2 - 4;
        if (mode === 'draw' && page) {
          page.drawRectangle({
            x: paddingX,
            y: toPdfY(cursorTop + boxH),
            width: contentW,
            height: boxH,
            color: rgb(calloutFillRgb.r, calloutFillRgb.g, calloutFillRgb.b),
            borderColor: rgb(borderRgb.r, borderRgb.g, borderRgb.b),
            borderWidth: 0.75,
          });
        }
        let innerY = cursorTop + boxPad;
        for (const line of lines) {
          if (mode === 'draw' && page && line) {
            page.drawText(line, {
              x: paddingX + boxPad,
              y: toPdfY(innerY + size),
              size,
              font: fonts.regular,
              color: rgb(inkRgb.r, inkRgb.g, inkRgb.b),
            });
          }
          innerY += lineH;
        }
        cursorTop += boxH + 8;
        break;
      }

      case 'code': {
        const size = 9.2;
        const lineH = 13.5;
        const boxPad = 10;
        const lines = wrapTextLines(block.content || '', fonts.mono, size, contentW - boxPad * 2);
        const boxH = lines.length * lineH + boxPad * 2 - 3;
        if (mode === 'draw' && page) {
          page.drawRectangle({
            x: paddingX,
            y: toPdfY(cursorTop + boxH),
            width: contentW,
            height: boxH,
            color: rgb(codeFillRgb.r, codeFillRgb.g, codeFillRgb.b),
            borderColor: rgb(borderRgb.r, borderRgb.g, borderRgb.b),
            borderWidth: 0.75,
          });
        }
        let innerY = cursorTop + boxPad;
        for (const line of lines) {
          if (mode === 'draw' && page && line) {
            page.drawText(line, {
              x: paddingX + boxPad,
              y: toPdfY(innerY + size),
              size,
              font: fonts.mono,
              color: rgb(inkRgb.r, inkRgb.g, inkRgb.b),
            });
          }
          innerY += lineH;
        }
        cursorTop += boxH + 8;
        break;
      }

      case 'table': {
        if (!block.table) break;
        const cols = Math.max(1, block.table.headers.length);
        const colW = contentW / cols;
        const cellPad = 6;
        const fontSize = 9;
        const lineH = 13;

        const allRows = [block.table.headers, ...block.table.rows];
        allRows.forEach((row, rIdx) => {
          const isHeader = rIdx === 0;
          const font = isHeader ? fonts.bold : fonts.regular;
          const wrappedCells = row.map((cell) =>
            wrapTextLines(cell || '', font, fontSize, Math.max(20, colW - cellPad * 2))
          );
          const maxLines = Math.max(1, ...wrappedCells.map((l) => l.length));
          const rowH = maxLines * lineH + cellPad * 2 - 2;

          if (mode === 'draw' && page) {
            for (let cIdx = 0; cIdx < cols; cIdx++) {
              const cx = paddingX + cIdx * colW;
              page.drawRectangle({
                x: cx,
                y: toPdfY(cursorTop + rowH),
                width: colW,
                height: rowH,
                color: isHeader ? rgb(surfaceRgb.r, surfaceRgb.g, surfaceRgb.b) : undefined,
                borderColor: rgb(borderRgb.r, borderRgb.g, borderRgb.b),
                borderWidth: 0.75,
              });
              const cellLines = wrappedCells[cIdx] ?? [''];
              cellLines.forEach((line, lIdx) => {
                if (line) {
                  page.drawText(line, {
                    x: cx + cellPad,
                    y: toPdfY(cursorTop + cellPad + fontSize + lIdx * lineH),
                    size: fontSize,
                    font,
                    color: rgb(inkRgb.r, inkRgb.g, inkRgb.b),
                  });
                }
              });
            }
          }
          cursorTop += rowH;
        });
        cursorTop += 10;
        break;
      }

      case 'drawing': {
        const logicalW = 860;
        const logicalH = block.drawing?.height || 270;
        const drawW = contentW;
        const drawH = Math.round((logicalH / logicalW) * drawW);

        if (mode === 'draw' && page) {
          page.drawRectangle({
            x: paddingX,
            y: toPdfY(cursorTop + drawH),
            width: drawW,
            height: drawH,
            borderColor: rgb(borderRgb.r, borderRgb.g, borderRgb.b),
            borderWidth: 0.6,
          });
        }

        if (block.drawing && block.drawing.strokes.length > 0) {
          drawingBoxes.push({
            strokes: block.drawing.strokes,
            x: paddingX,
            yTop: cursorTop,
            w: drawW,
            h: drawH,
            logicalW,
            logicalH,
          });
        }

        cursorTop += drawH + 4;
        if (block.content?.trim()) {
          const capLines = wrapTextLines(block.content, fonts.italic, 8.8, contentW);
          for (const line of capLines) {
            if (mode === 'draw' && page && line) {
              page.drawText(line, {
                x: paddingX,
                y: toPdfY(cursorTop + 9),
                size: 8.8,
                font: fonts.italic,
                color: rgb(mutedRgb.r, mutedRgb.g, mutedRgb.b),
              });
            }
            cursorTop += 12;
          }
        }
        cursorTop += 6;
        break;
      }

      case 'image': {
        const embedded = imagesMap.get(block.id);
        if (embedded) {
          if (mode === 'draw' && page) {
            page.drawImage(embedded.image, {
              x: paddingX,
              y: toPdfY(cursorTop + embedded.drawH),
              width: embedded.drawW,
              height: embedded.drawH,
            });
          }
          cursorTop += embedded.drawH + 6;
        }
        if (block.image?.caption) {
          const capLines = wrapTextLines(block.image.caption, fonts.italic, 8.8, contentW);
          for (const line of capLines) {
            if (mode === 'draw' && page && line) {
              page.drawText(line, {
                x: paddingX,
                y: toPdfY(cursorTop + 9),
                size: 8.8,
                font: fonts.italic,
                color: rgb(mutedRgb.r, mutedRgb.g, mutedRgb.b),
              });
            }
            cursorTop += 12;
          }
        }
        cursorTop += 6;
        break;
      }

      case 'audio': {
        if (block.audio) {
          const label = sanitizePdfText(
            `[Audio gravado: ${block.audio.label} (${block.audio.durationSec}s)]`
          );
          if (mode === 'draw' && page) {
            page.drawText(label, {
              x: paddingX,
              y: toPdfY(cursorTop + 10),
              size: 9.5,
              font: fonts.italic,
              color: rgb(mutedRgb.r, mutedRgb.g, mutedRgb.b),
            });
          }
          cursorTop += 18;
        }
        break;
      }

      case 'link': {
        if (block.link) {
          const label = sanitizePdfText(`${block.link.title || block.link.url}`);
          const url = sanitizePdfText(block.link.url);
          const lines = wrapTextLines(label, fonts.bold, 10, contentW - 16);
          const urlLines = url && url !== label ? wrapTextLines(url, fonts.regular, 8.5, contentW - 16) : [];
          const boxH = lines.length * 14 + urlLines.length * 12 + 14;
          if (mode === 'draw' && page) {
            page.drawRectangle({
              x: paddingX,
              y: toPdfY(cursorTop + boxH),
              width: contentW,
              height: boxH,
              color: rgb(surfaceRgb.r, surfaceRgb.g, surfaceRgb.b),
              borderColor: rgb(borderRgb.r, borderRgb.g, borderRgb.b),
              borderWidth: 0.75,
            });
          }
          let innerY = cursorTop + 8;
          for (const line of lines) {
            if (mode === 'draw' && page && line) {
              page.drawText(line, {
                x: paddingX + 8,
                y: toPdfY(innerY + 10),
                size: 10,
                font: fonts.bold,
                color: rgb(accentRgb.r, accentRgb.g, accentRgb.b),
              });
            }
            innerY += 14;
          }
          for (const line of urlLines) {
            if (mode === 'draw' && page && line) {
              page.drawText(line, {
                x: paddingX + 8,
                y: toPdfY(innerY + 8.5),
                size: 8.5,
                font: fonts.regular,
                color: rgb(mutedRgb.r, mutedRgb.g, mutedRgb.b),
              });
            }
            innerY += 12;
          }
          cursorTop += boxH + 8;
        }
        break;
      }
    }
  }

  return { totalHeight: cursorTop + 32, drawingBoxes };
}

function drawPaperPattern(
  page: PDFPage,
  notePage: NotePage,
  pdfW: number,
  pdfH: number,
  bgHex: string,
  isSheetDark: boolean
) {
  const bg = hexToRgb01(bgHex);
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pdfW,
    height: pdfH,
    color: rgb(bg.r, bg.g, bg.b),
  });

  if (notePage.paperStyle === 'plain') return;

  const lineColor = isSheetDark
    ? rgb(0.28, 0.34, 0.45)
    : rgb(0.79, 0.84, 0.91);

  if (notePage.paperStyle === 'ruled') {
    const step = 24;
    for (let topY = step * 1.5; topY < pdfH - 12; topY += step) {
      const y = pdfH - topY;
      page.drawLine({
        start: { x: 0, y },
        end: { x: pdfW, y },
        thickness: 0.5,
        color: lineColor,
        opacity: isSheetDark ? 0.38 : 0.65,
      });
    }
    // Classic notebook vertical margin line
    const marginX = Math.max(36, Math.round(pdfW * 0.1));
    page.drawLine({
      start: { x: marginX, y: 0 },
      end: { x: marginX, y: pdfH },
      thickness: 0.7,
      color: rgb(0.95, 0.45, 0.48),
      opacity: isSheetDark ? 0.3 : 0.45,
    });
  } else if (notePage.paperStyle === 'grid') {
    const step = 21;
    for (let x = step; x < pdfW; x += step) {
      page.drawLine({
        start: { x, y: 0 },
        end: { x, y: pdfH },
        thickness: 0.45,
        color: lineColor,
        opacity: isSheetDark ? 0.32 : 0.55,
      });
    }
    for (let topY = step; topY < pdfH; topY += step) {
      const y = pdfH - topY;
      page.drawLine({
        start: { x: 0, y },
        end: { x: pdfW, y },
        thickness: 0.45,
        color: lineColor,
        opacity: isSheetDark ? 0.32 : 0.55,
      });
    }
  } else if (notePage.paperStyle === 'dotted') {
    const step = 21;
    const dotColor = isSheetDark ? rgb(0.45, 0.52, 0.65) : rgb(0.65, 0.72, 0.82);
    for (let x = step; x < pdfW - 8; x += step) {
      for (let topY = step; topY < pdfH - 8; topY += step) {
        page.drawCircle({
          x,
          y: pdfH - topY,
          size: 0.8,
          color: dotColor,
          opacity: isSheetDark ? 0.55 : 0.75,
        });
      }
    }
  }
}

export interface ExportLayeredPdfOptions {
  filename: string;
  appTheme: ThemeMode;
  sheetAspectRatios?: Record<string, number>;
  onProgress?: (current: number, total: number) => void;
}

export async function exportPagesToLayeredPdf(
  pages: NotePage[],
  options: ExportLayeredPdfOptions
): Promise<void> {
  if (pages.length === 0) return;

  const outDoc = await PDFDocument.create();
  outDoc.setCreator('FolioNotes');
  outDoc.setProducer('FolioNotes Layered Vector PDF Exporter');

  const regular = await outDoc.embedFont(StandardFonts.Helvetica);
  const bold = await outDoc.embedFont(StandardFonts.HelveticaBold);
  const italic = await outDoc.embedFont(StandardFonts.HelveticaOblique);
  const mono = await outDoc.embedFont(StandardFonts.Courier);
  const fonts = { regular, bold, italic, mono };

  // Register PDF 1.5+ Optional Content Groups (Camadas)
  const ctx = outDoc.context;
  const createOcg = (name: string): PDFRef =>
    ctx.register(
      ctx.obj({
        Type: 'OCG',
        Name: PDFHexString.fromText(name),
      })
    );

  const bgOcgRef = createOcg('Papel e PDF Original');
  const textOcgRef = createOcg('Texto e Blocos');
  const hlOcgRef = createOcg('Marca-texto');
  const inkOcgRef = createOcg('Anotações e Desenhos');
  const allOcgRefs = [bgOcgRef, textOcgRef, hlOcgRef, inkOcgRef];

  outDoc.catalog.set(
    PDFName.of('OCProperties'),
    ctx.obj({
      OCGs: allOcgRefs,
      D: {
        BaseState: 'ON',
        Order: allOcgRefs,
        ON: allOcgRefs,
        ListMode: 'AllPages',
      },
    })
  );

  // Shared ExtGState for translucent Multiply highlighter layer
  const hlExtGStateRef = ctx.register(
    ctx.obj({
      Type: 'ExtGState',
      ca: 0.36,
      CA: 0.36,
      BM: 'Multiply',
    })
  );

  const sourcePdfCache = new Map<string, PDFDocument | null>();

  const loadSourcePdfDoc = async (pdfId: string): Promise<PDFDocument | null> => {
    if (sourcePdfCache.has(pdfId)) return sourcePdfCache.get(pdfId) ?? null;
    try {
      const record = await loadPdfBinary(pdfId);
      if (!record?.data) {
        sourcePdfCache.set(pdfId, null);
        return null;
      }
      const srcDoc = await PDFDocument.load(record.data, { ignoreEncryption: true });
      sourcePdfCache.set(pdfId, srcDoc);
      return srcDoc;
    } catch {
      sourcePdfCache.set(pdfId, null);
      return null;
    }
  };

  for (let idx = 0; idx < pages.length; idx++) {
    options.onProgress?.(idx + 1, pages.length);
    const notePage = pages[idx];

    const pageFormat = notePage.pageFormat ?? DEFAULT_PAGE_FORMAT;
    const pdfW = Math.max(120, pageFormat.widthMm * MM_TO_PT);
    const basePdfH = Math.max(120, pageFormat.heightMm * MM_TO_PT);
    const paddingX = Math.min(44, Math.round(pdfW * 0.07));
    const paddingTop = notePage.pdfBackground ? 18 : 34;
    const contentW = Math.max(80, pdfW - paddingX * 2);

    const pageColorId = notePage.pageColor ?? 'auto';
    const swatch = PAGE_COLOR_SWATCHES.find((s) => s.id === pageColorId) ?? PAGE_COLOR_SWATCHES[0];
    const resolvedBgHex = notePage.pdfBackground
      ? '#FFFFFF'
      : pageColorId === 'white'
      ? '#FFFFFF'
      : options.appTheme === 'dark'
      ? swatch.darkHex
      : swatch.lightHex;
    const isSheetDark =
      !notePage.pdfBackground &&
      (pageColorId === 'black' || (pageColorId === 'auto' && options.appTheme === 'dark'));

    // Pre-embed any inline images on this page
    const imagesMap = new Map<string, EmbeddedImageItem>();
    for (const blk of notePage.blocks) {
      if (blk.type === 'image' && blk.image?.url.startsWith('data:image/')) {
        const embeddedImg = await embedImageFromDataUrl(outDoc, blk.image.url);
        if (embeddedImg) {
          const maxImgH = 280;
          const scale = Math.min(1, contentW / embeddedImg.width, maxImgH / embeddedImg.height);
          imagesMap.set(blk.id, {
            blockId: blk.id,
            image: embeddedImg,
            drawW: embeddedImg.width * scale,
            drawH: embeddedImg.height * scale,
          });
        }
      }
    }

    // Measure blocks height first so tall pages never clip and ink maps accurately
    const { totalHeight: measuredBlocksH } = measureAndDrawBlocks('measure', {
      page: null,
      notePage,
      pdfW,
      pdfH: basePdfH,
      paddingX,
      paddingTop,
      contentW,
      isSheetDark,
      fonts,
      imagesMap,
    });

    const domAspect = options.sheetAspectRatios?.[notePage.id];
    const domPdfH = domAspect ? pdfW * domAspect : 0;
    const pdfH =
      notePage.pdfBackground && notePage.blocks.length === 0
        ? basePdfH
        : Math.max(basePdfH, domPdfH, measuredBlocksH);

    const logicalHeight = Math.max(320, Math.round((pdfH / pdfW) * INK_LOGICAL_WIDTH));

    const outPage = outDoc.addPage([pdfW, pdfH]);
    outPage.node.normalize();
    const resources = outPage.node.Resources()!;

    // Attach OCG Properties dictionary to this page
    let props = resources.lookupMaybe(PDFName.of('Properties'), PDFDict);
    if (!props) {
      props = ctx.obj({});
      resources.set(PDFName.of('Properties'), props);
    }
    props.set(PDFName.of('LBg'), bgOcgRef);
    props.set(PDFName.of('LTxt'), textOcgRef);
    props.set(PDFName.of('LHl'), hlOcgRef);
    props.set(PDFName.of('LInk'), inkOcgRef);

    const hlGsKey = outPage.node.newExtGState('FolioHL', hlExtGStateRef);

    // =========================================================
    // CAMADA 1: Papel / PDF Original (LBg)
    // =========================================================
    outPage.pushOperators(beginLayerOp('LBg'));

    if (notePage.pdfBackground) {
      outPage.drawRectangle({
        x: 0,
        y: 0,
        width: pdfW,
        height: pdfH,
        color: rgb(1, 1, 1),
      });

      const pdfAspect =
        notePage.pdfBackground.aspectRatio ?? pageFormat.widthMm / Math.max(1, pageFormat.heightMm);
      const containRect = getPdfContainRect(pdfW, pdfH, pdfAspect);
      const targetBottomY = pdfH - containRect.y - containRect.h;

      let drewVectorPdf = false;
      if (notePage.pdfBackground.pdfId) {
        const srcDoc = await loadSourcePdfDoc(notePage.pdfBackground.pdfId);
        const pageIdx = Math.max(0, notePage.pdfBackground.pageNumber - 1);
        if (srcDoc && pageIdx < srcDoc.getPageCount()) {
          try {
            const embeddedSrcPage = await outDoc.embedPage(srcDoc.getPage(pageIdx));
            outPage.drawPage(embeddedSrcPage, {
              x: containRect.x,
              y: targetBottomY,
              width: containRect.w,
              height: containRect.h,
            });
            drewVectorPdf = true;
          } catch {
            drewVectorPdf = false;
          }
        }

        if (!drewVectorPdf) {
          const fallbackBytes = await renderPdfPageFallbackPng(
            notePage.pdfBackground.pdfId,
            notePage.pdfBackground.pageNumber
          );
          if (fallbackBytes) {
            const img = await outDoc.embedPng(fallbackBytes);
            outPage.drawImage(img, {
              x: containRect.x,
              y: targetBottomY,
              width: containRect.w,
              height: containRect.h,
            });
          }
        }
      } else if (notePage.pdfBackground.dataUrl) {
        const legacyImg = await embedImageFromDataUrl(outDoc, notePage.pdfBackground.dataUrl);
        if (legacyImg) {
          outPage.drawImage(legacyImg, {
            x: containRect.x,
            y: targetBottomY,
            width: containRect.w,
            height: containRect.h,
          });
        }
      }
    } else {
      drawPaperPattern(outPage, notePage, pdfW, pdfH, resolvedBgHex, isSheetDark);
    }

    outPage.pushOperators(endMarkedContent());

    // =========================================================
    // CAMADA 2: Texto e Blocos (LTxt)
    // =========================================================
    outPage.pushOperators(beginLayerOp('LTxt'));
    const { drawingBoxes } = measureAndDrawBlocks('draw', {
      page: outPage,
      notePage,
      pdfW,
      pdfH,
      paddingX,
      paddingTop,
      contentW,
      isSheetDark,
      fonts,
      imagesMap,
    });
    outPage.pushOperators(endMarkedContent());

    // Split page ink & inline drawing strokes into Highlighter vs Pen layers
    const pageStrokes = notePage.inkStrokes ?? [];
    const pageHighlighters = pageStrokes.filter((s) => s.tool === 'highlighter');
    const pagePens = pageStrokes.filter((s) => s.tool !== 'highlighter');

    // =========================================================
    // CAMADA 3: Marca-texto (LHl) — com BlendMode Multiply
    // =========================================================
    outPage.pushOperators(beginLayerOp('LHl'));
    for (const box of drawingBoxes) {
      const boxHls = box.strokes.filter((s) => s.tool === 'highlighter');
      if (boxHls.length > 0) {
        drawVectorStrokeList(outPage, boxHls, {
          originX: box.x,
          originTopY: box.yTop,
          targetW: box.w,
          targetH: box.h,
          logicalW: box.logicalW,
          logicalH: box.logicalH,
          pdfPageH: pdfH,
          adaptDarkInk: isSheetDark,
          hlGraphicsStateKey: hlGsKey,
        });
      }
    }
    if (pageHighlighters.length > 0) {
      drawVectorStrokeList(outPage, pageHighlighters, {
        originX: 0,
        originTopY: 0,
        targetW: pdfW,
        targetH: pdfH,
        logicalW: INK_LOGICAL_WIDTH,
        logicalH: logicalHeight,
        pdfPageH: pdfH,
        adaptDarkInk: isSheetDark,
        hlGraphicsStateKey: hlGsKey,
      });
    }
    outPage.pushOperators(endMarkedContent());

    // =========================================================
    // CAMADA 4: Anotações e Desenhos Vetoriais (LInk)
    // =========================================================
    outPage.pushOperators(beginLayerOp('LInk'));
    for (const box of drawingBoxes) {
      const boxPens = box.strokes.filter((s) => s.tool !== 'highlighter');
      if (boxPens.length > 0) {
        drawVectorStrokeList(outPage, boxPens, {
          originX: box.x,
          originTopY: box.yTop,
          targetW: box.w,
          targetH: box.h,
          logicalW: box.logicalW,
          logicalH: box.logicalH,
          pdfPageH: pdfH,
          adaptDarkInk: isSheetDark,
        });
      }
    }
    if (pagePens.length > 0) {
      drawVectorStrokeList(outPage, pagePens, {
        originX: 0,
        originTopY: 0,
        targetW: pdfW,
        targetH: pdfH,
        logicalW: INK_LOGICAL_WIDTH,
        logicalH: logicalHeight,
        pdfPageH: pdfH,
        adaptDarkInk: isSheetDark,
      });
    }
    outPage.pushOperators(endMarkedContent());

    if (!outPage.node.Resources()) {
      outPage.node.set(PDFName.of('Resources'), resources);
    }
  }

  const pdfBytes = await outDoc.save();
  const safeBytes = new Uint8Array(pdfBytes);
  const blob = new Blob([safeBytes.buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = options.filename.endsWith('.pdf') ? options.filename : `${options.filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
