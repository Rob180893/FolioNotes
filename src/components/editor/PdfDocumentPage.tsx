import React, { useEffect, useRef, useState } from 'react';
import type { PdfPageBackground, PdfTextBox } from '../../types/notes';
import { extractTextBoxesFromPdfPage, getPdfPageProxy } from '../../services/pdf/pdfImportService';

interface PdfDocumentPageProps {
  pdfBackground: PdfPageBackground;
  onExtractTextBoxes?: (textBoxes: PdfTextBox[]) => void;
}

export const PdfDocumentPage: React.FC<PdfDocumentPageProps> = ({
  pdfBackground,
  onExtractTextBoxes,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onExtractRef = useRef(onExtractTextBoxes);
  onExtractRef.current = onExtractTextBoxes;
  const hasAttemptedBackfillRef = useRef(false);

  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: 794,
    height: 1123,
  });
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    pdfBackground.pdfId ? 'loading' : 'ready'
  );

  useEffect(() => {
    hasAttemptedBackfillRef.current = false;
  }, [pdfBackground.pdfId, pdfBackground.pageNumber]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize((prev) =>
          Math.abs(prev.width - rect.width) > 2 || Math.abs(prev.height - rect.height) > 2
            ? { width: rect.width, height: rect.height }
            : prev
        );
      }
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pdfBackground.pdfId) return;

    let cancelled = false;
    let activeRenderTask: { cancel: () => void; promise: Promise<void> } | null = null;
    let loadedPage: Awaited<ReturnType<typeof getPdfPageProxy>> = null;

    const renderPdfPage = async () => {
      try {
        const page = await getPdfPageProxy(pdfBackground.pdfId!, pdfBackground.pageNumber);
        if (cancelled) {
          page?.cleanup();
          return;
        }
        if (!page) {
          setStatus('error');
          return;
        }
        loadedPage = page;

        // Backfill PDF text coordinates if missing on an already-imported PDF
        if (
          !hasAttemptedBackfillRef.current &&
          (!pdfBackground.textBoxes || pdfBackground.textBoxes.length === 0) &&
          onExtractRef.current
        ) {
          hasAttemptedBackfillRef.current = true;
          const extracted = await extractTextBoxesFromPdfPage(page);
          if (!cancelled && extracted.length > 0) {
            onExtractRef.current(extracted);
          }
        }

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const pdfAspect = baseViewport.width / Math.max(1, baseViewport.height);
        const containerAspect = containerSize.width / Math.max(1, containerSize.height);

        const targetCssWidth =
          containerAspect > pdfAspect
            ? containerSize.height * pdfAspect
            : containerSize.width;

        const dpr = Math.min(2.5, Math.max(1.5, window.devicePixelRatio || 1.5));
        const renderScale = Math.max(0.5, (targetCssWidth * dpr) / Math.max(1, baseViewport.width));
        const viewport = page.getViewport({ scale: renderScale });

        canvas.width = Math.max(1, Math.round(viewport.width));
        canvas.height = Math.max(1, Math.round(viewport.height));

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Preserve original PDF appearance (white paper, original colors) regardless of sheet/app theme
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const task = page.render({
          canvas,
          canvasContext: ctx,
          viewport,
          background: 'rgb(255, 255, 255)',
        });
        activeRenderTask = task;

        await task.promise;
        if (!cancelled) {
          setStatus('ready');
        }
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : '';
        if (name === 'RenderingCancelledException') return;
        setStatus('error');
      }
    };

    void renderPdfPage();

    return () => {
      cancelled = true;
      try {
        activeRenderTask?.cancel();
      } catch {
        // ignore cancel errors
      }
      try {
        loadedPage?.cleanup();
      } catch {
        // ignore cleanup errors
      }
    };
  }, [
    pdfBackground.pdfId,
    pdfBackground.pageNumber,
    pdfBackground.textBoxes,
    containerSize.width,
    containerSize.height,
  ]);

  // Legacy fallback only for PDFs imported prior to native PDF binary storage
  if (!pdfBackground.pdfId && pdfBackground.dataUrl) {
    return (
      <img
        src={pdfBackground.dataUrl}
        alt={`${pdfBackground.fileName} — página ${pdfBackground.pageNumber}`}
        draggable={false}
        className="print-pdf-layer pointer-events-none absolute inset-0 z-0 h-full w-full object-contain select-none"
      />
    );
  }

  return (
    <div
      ref={containerRef}
      aria-label={`Documento PDF ${pdfBackground.fileName}, página ${pdfBackground.pageNumber}`}
      className="print-pdf-layer pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden select-none"
    >
      <canvas
        ref={canvasRef}
        className={`h-full w-full object-contain transition-opacity duration-150 ${
          status === 'ready' ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
          Renderizando PDF...
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-slate-400">
          Não foi possível carregar a página {pdfBackground.pageNumber} de {pdfBackground.fileName}.
        </div>
      )}
    </div>
  );
};
