import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PdfTextBox } from '../../types/notes';
import { loadPdfBinary, savePdfBinary } from './pdfBinaryStore';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const PT_TO_MM = 25.4 / 72;
const MAX_PDF_PAGES = 50;

const documentProxyCache = new Map<string, Promise<pdfjsLib.PDFDocumentProxy>>();

export interface ExtractedPdfPage {
  pdfId: string;
  aspectRatio: number;
  widthMm: number;
  heightMm: number;
  pageNumber: number;
  totalPages: number;
  textBoxes: PdfTextBox[];
}

function clampMmPreservingAspect(rawW: number, rawH: number): { widthMm: number; heightMm: number } {
  const aspect = rawH / Math.max(1, rawW);
  let widthMm = Math.round(rawW);
  if (widthMm < 120) widthMm = 148;
  if (widthMm > 340) widthMm = 297;
  const heightMm = Math.max(80, Math.min(600, Math.round(widthMm * aspect)));
  return { widthMm, heightMm };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function extractNormalizedTextBoxes(
  items: Array<unknown>,
  viewportTransform: number[],
  pageWidth: number,
  pageHeight: number
): PdfTextBox[] {
  const boxes: PdfTextBox[] = [];
  if (pageWidth <= 0 || pageHeight <= 0) return boxes;

  for (const rawItem of items) {
    if (!rawItem || typeof rawItem !== 'object' || !('str' in rawItem) || !('transform' in rawItem)) {
      continue;
    }
    const item = rawItem as {
      str: string;
      transform: number[];
      width: number;
      height: number;
    };
    const str = item.str;
    if (!str || !str.trim() || !Array.isArray(item.transform) || item.transform.length < 6) {
      continue;
    }

    const tx = pdfjsLib.Util.transform(viewportTransform, item.transform);
    const originX = Number(tx[4]);
    const baselineY = Number(tx[5]);
    const angle = Math.atan2(Number(tx[1]), Number(tx[0]));
    const fontH = Math.max(4, Math.hypot(Number(tx[2]), Number(tx[3])) || item.height || 10);
    const totalW = Number(item.width);

    if (!Number.isFinite(originX) || !Number.isFinite(baselineY) || !Number.isFinite(totalW) || totalW <= 0.5) {
      continue;
    }

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const isNearHorizontal = Math.abs(sin) < 0.25 && cos > 0.75;
    const totalLen = Math.max(1, str.length);
    const wordMatches = Array.from(str.matchAll(/\S+/g));

    if (isNearHorizontal) {
      const topY = baselineY - fontH * 0.86;
      const boxH = fontH * 1.12;

      if (wordMatches.length <= 1) {
        const nx = Math.max(0, Math.min(1, originX / pageWidth));
        const ny = Math.max(0, Math.min(1, topY / pageHeight));
        const nw = Math.max(0.002, Math.min(1 - nx, totalW / pageWidth));
        const nh = Math.max(0.005, Math.min(1 - ny, boxH / pageHeight));
        boxes.push({ x: round4(nx), y: round4(ny), w: round4(nw), h: round4(nh) });
      } else {
        for (const match of wordMatches) {
          const startIdx = match.index ?? 0;
          const wordLen = match[0].length;
          const wordX = originX + (startIdx / totalLen) * totalW;
          const wordW = (wordLen / totalLen) * totalW;
          const nx = Math.max(0, Math.min(1, wordX / pageWidth));
          const ny = Math.max(0, Math.min(1, topY / pageHeight));
          const nw = Math.max(0.002, Math.min(1 - nx, wordW / pageWidth));
          const nh = Math.max(0.005, Math.min(1 - ny, boxH / pageHeight));
          boxes.push({ x: round4(nx), y: round4(ny), w: round4(nw), h: round4(nh) });
        }
      }
    } else {
      // Handle rotated text runs by computing bounding box along text angle
      const itemsToEmit =
        wordMatches.length <= 1
          ? [{ start: 0, len: totalLen }]
          : wordMatches.map((m) => ({ start: m.index ?? 0, len: m[0].length }));

      for (const seg of itemsToEmit) {
        const startDist = (seg.start / totalLen) * totalW;
        const endDist = ((seg.start + seg.len) / totalLen) * totalW;
        const p1x = originX + cos * startDist;
        const p1y = baselineY + sin * startDist;
        const p2x = originX + cos * endDist;
        const p2y = baselineY + sin * endDist;
        const upX = sin * fontH * 0.86;
        const upY = -cos * fontH * 0.86;
        const downX = -sin * fontH * 0.26;
        const downY = cos * fontH * 0.26;

        const xs = [p1x + upX, p2x + upX, p1x + downX, p2x + downX];
        const ys = [p1y + upY, p2y + upY, p1y + downY, p2y + downY];
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const nx = Math.max(0, Math.min(1, minX / pageWidth));
        const ny = Math.max(0, Math.min(1, minY / pageHeight));
        const nw = Math.max(0.002, Math.min(1 - nx, (maxX - minX) / pageWidth));
        const nh = Math.max(0.005, Math.min(1 - ny, (maxY - minY) / pageHeight));
        boxes.push({ x: round4(nx), y: round4(ny), w: round4(nw), h: round4(nh) });
      }
    }
  }

  return boxes;
}

export async function extractTextBoxesFromPdfPage(
  page: pdfjsLib.PDFPageProxy
): Promise<PdfTextBox[]> {
  try {
    const baseViewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    return extractNormalizedTextBoxes(
      textContent.items,
      baseViewport.transform,
      baseViewport.width,
      baseViewport.height
    );
  } catch {
    return [];
  }
}

export async function getPdfDocumentProxy(pdfId: string): Promise<pdfjsLib.PDFDocumentProxy | null> {
  const existing = documentProxyCache.get(pdfId);
  if (existing) {
    try {
      return await existing;
    } catch {
      documentProxyCache.delete(pdfId);
    }
  }

  const promise = (async () => {
    const stored = await loadPdfBinary(pdfId);
    if (!stored) {
      throw new Error('Documento PDF não encontrado no armazenamento local.');
    }
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(stored.data.slice(0)) });
    return loadingTask.promise;
  })();

  documentProxyCache.set(pdfId, promise);
  try {
    return await promise;
  } catch {
    documentProxyCache.delete(pdfId);
    return null;
  }
}

export async function getPdfPageProxy(
  pdfId: string,
  pageNumber: number
): Promise<pdfjsLib.PDFPageProxy | null> {
  const doc = await getPdfDocumentProxy(pdfId);
  if (!doc) return null;
  return doc.getPage(pageNumber);
}

export async function extractPdfPages(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<ExtractedPdfPage[]> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    throw new Error('Selecione um arquivo PDF válido (.pdf).');
  }

  const buffer = await file.arrayBuffer();
  const pdfId = `pdf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  // Persist the actual PDF binary in IndexedDB so it stays a real PDF document (not converted to image)
  await savePdfBinary(pdfId, file.name, buffer);

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer.slice(0)) });
  const docPromise = loadingTask.promise;
  documentProxyCache.set(pdfId, docPromise);

  const results: ExtractedPdfPage[] = [];

  try {
    const pdfDoc = await docPromise;
    const totalPages = Math.min(pdfDoc.numPages, MAX_PDF_PAGES);

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      onProgress?.(pageNumber, totalPages);
      const page = await pdfDoc.getPage(pageNumber);
      try {
        const baseViewport = page.getViewport({ scale: 1 });
        const rawWidthMm = baseViewport.width * PT_TO_MM;
        const rawHeightMm = baseViewport.height * PT_TO_MM;
        const { widthMm, heightMm } = clampMmPreservingAspect(rawWidthMm, rawHeightMm);
        const aspectRatio = baseViewport.width / Math.max(1, baseViewport.height);

        let textBoxes: PdfTextBox[] = [];
        try {
          const textContent = await page.getTextContent();
          textBoxes = extractNormalizedTextBoxes(
            textContent.items,
            baseViewport.transform,
            baseViewport.width,
            baseViewport.height
          );
        } catch {
          textBoxes = [];
        }

        results.push({
          pdfId,
          aspectRatio,
          widthMm,
          heightMm,
          pageNumber,
          totalPages: pdfDoc.numPages,
          textBoxes,
        });
      } finally {
        page.cleanup();
      }
    }
  } catch (error) {
    documentProxyCache.delete(pdfId);
    throw error;
  }

  return results;
}
