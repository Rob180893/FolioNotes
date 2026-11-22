import React, { useEffect, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import {
  DEFAULT_PAGE_FORMAT,
  PAGE_COLOR_SWATCHES,
  type BlockType,
  type NoteBlock,
  type NotePage,
  type PenTool,
  type ThemeMode,
} from '../../types/notes';
import { BlockItem } from './BlockItem';
import { PageInkOverlay, type PageInkOverlayHandle } from '../canvas/PageInkOverlay';
import { PdfDocumentPage } from './PdfDocumentPage';

const MM_TO_PX = 3.78;

interface PageSheetProps {
  page: NotePage;
  pageNumber: number;
  totalPages: number;
  appTheme: ThemeMode;
  isActive: boolean;
  isInkMode: boolean;
  penTool: PenTool;
  penColor: string;
  penWidth: number;
  highlighterWidth?: number;
  eraserWidth?: number;
  isHorizontalLayout?: boolean;
  isOcrLoading: boolean;
  focusedBlockId: string | null;
  onActivate: () => void;
  onUpdatePage: (patch: Partial<NotePage>) => void;
  onUpdateBlock: (blockId: string, patch: Partial<NoteBlock>) => void;
  onConvertBlockType: (blockId: string, newType: BlockType) => void;
  onInsertAfter: (afterBlockId: string | null, type: BlockType) => void;
  onDeleteBlock: (blockId: string) => void;
  onMoveBlock: (blockId: string, dir: 'up' | 'down') => void;
  onRunOcr: (pngDataUrl: string) => void;
  registerSheetElement: (el: HTMLDivElement | null) => void;
  registerInkOverlay: (handle: PageInkOverlayHandle | null) => void;
}

export const PageSheet: React.FC<PageSheetProps> = ({
  page,
  pageNumber,
  totalPages,
  appTheme,
  isActive,
  isInkMode,
  penTool,
  penColor,
  penWidth,
  highlighterWidth = 18,
  eraserWidth = 18,
  isHorizontalLayout = false,
  isOcrLoading,
  focusedBlockId,
  onActivate,
  onUpdatePage,
  onUpdateBlock,
  onConvertBlockType,
  onInsertAfter,
  onDeleteBlock,
  onMoveBlock,
  onRunOcr,
  registerSheetElement,
  registerInkOverlay,
}) => {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const inkOverlayRef = useRef<PageInkOverlayHandle | null>(null);
  const registerSheetRef = useRef(registerSheetElement);
  const registerInkRef = useRef(registerInkOverlay);
  registerSheetRef.current = registerSheetElement;
  registerInkRef.current = registerInkOverlay;

  useEffect(() => {
    registerSheetRef.current(sheetRef.current);
    return () => registerSheetRef.current(null);
  }, []);

  useEffect(() => {
    registerInkRef.current(inkOverlayRef.current);
    return () => registerInkRef.current(null);
  }, []);

  const paperClass = {
    plain: 'paper-plain',
    ruled: 'paper-ruled',
    grid: 'paper-grid',
    dotted: 'paper-dotted',
  }[page.paperStyle];

  const pageColorId = page.pageColor ?? 'auto';
  const swatch = PAGE_COLOR_SWATCHES.find((s) => s.id === pageColorId) ?? PAGE_COLOR_SWATCHES[0];
  const resolvedBg =
    pageColorId === 'white'
      ? '#FFFFFF'
      : appTheme === 'dark'
      ? swatch.darkHex
      : swatch.lightHex;
  const isSheetDark =
    pageColorId === 'black' || (pageColorId === 'auto' && appTheme === 'dark');

  const pageFormat = page.pageFormat ?? DEFAULT_PAGE_FORMAT;
  const sheetWidthPx = Math.round(pageFormat.widthMm * MM_TO_PX);
  const sheetHeightPx = Math.round(pageFormat.heightMm * MM_TO_PX);
  const pdfAspectRatio =
    page.pdfBackground?.aspectRatio ?? pageFormat.widthMm / Math.max(1, pageFormat.heightMm);

  let numberedCounter = 0;

  return (
    <div
      ref={sheetRef}
      onMouseDownCapture={() => {
        if (!isActive) onActivate();
      }}
      onFocusCapture={() => {
        if (!isActive) onActivate();
      }}
      onPointerDownCapture={(e) => {
        if (!isActive) onActivate();
        // Finger touch MUST strictly scroll/move pages; never write, highlight, or erase
        if (e.pointerType === 'touch') return;
        const shouldStartExternalStroke =
          (e.pointerType === 'pen' && !(isActive && isInkMode)) ||
          (isInkMode && !isActive);
        if (shouldStartExternalStroke) {
          const target = e.target as HTMLElement | null;
          if (target?.closest('button, a, select, canvas, [data-no-pen-ink]')) {
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          inkOverlayRef.current?.beginExternalPenStroke(e);
        }
      }}
      style={
        {
          '--sheet-bg': resolvedBg,
          width: `${sheetWidthPx}px`,
          maxWidth: isHorizontalLayout ? '92vw' : '100%',
          ...(page.pdfBackground && page.blocks.length === 0
            ? { aspectRatio: `${pageFormat.widthMm} / ${pageFormat.heightMm}` }
            : { minHeight: `${sheetHeightPx}px` }),
        } as React.CSSProperties & { '--sheet-bg': string }
      }
      className={`${
        isSheetDark ? 'sheet-dark' : 'sheet-light'
      } ${
        isActive
          ? 'print-only-sheet ring-2 ring-indigo-500/30 border-indigo-400/70 dark:border-indigo-600/70'
          : 'no-print border-slate-200/90 dark:border-slate-800'
      } ${isHorizontalLayout ? 'shrink-0' : 'mx-auto'} group/sheet relative flex flex-col overflow-hidden rounded-2xl border shadow-sm px-6 sm:px-14 ${
        page.pdfBackground ? 'py-5 sm:py-6' : 'py-8 sm:py-12'
      } transition-[width,min-height,background-color,colors] duration-200 ${paperClass}`}
    >
      {page.pdfBackground && (
        <PdfDocumentPage
          pdfBackground={page.pdfBackground}
          onExtractTextBoxes={(textBoxes) =>
            onUpdatePage({
              pdfBackground: {
                ...page.pdfBackground!,
                textBoxes,
              },
            })
          }
        />
      )}

      <PageInkOverlay
        ref={inkOverlayRef}
        sheetRef={sheetRef}
        strokes={page.inkStrokes || []}
        isInkMode={isActive && isInkMode}
        tool={penTool}
        color={penColor}
        strokeWidth={penWidth}
        highlighterWidth={highlighterWidth}
        eraserWidth={eraserWidth}
        isSheetDark={isSheetDark && !page.pdfBackground}
        pdfTextBoxes={page.pdfBackground?.textBoxes}
        pdfAspectRatio={pdfAspectRatio}
        onChangeStrokes={(nextStrokes) => onUpdatePage({ inkStrokes: nextStrokes })}
      />

      {/* Hover-only Optional Controls (PDF detach / Restore Title) */}
      {(page.pdfBackground || page.hideTitle) && (
        <div className="no-print absolute right-4 top-3 z-30 flex items-center gap-2 opacity-0 group-hover/sheet:opacity-100 focus-within:opacity-100 transition-opacity">
          {page.pdfBackground && (
            <div className="flex items-center gap-2 rounded-md bg-white/90 dark:bg-slate-900/90 px-2.5 py-1 text-[11px] text-slate-600 dark:text-slate-300 shadow-xs backdrop-blur-xs">
              <span className="max-w-[180px] truncate font-medium">
                {page.pdfBackground.fileName}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums text-slate-400">
                Pág. {page.pdfBackground.pageNumber}/{page.pdfBackground.totalPages}
              </span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => onUpdatePage({ pdfBackground: undefined })}
                className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300 hover:text-rose-600 cursor-pointer"
                title="Remover documento PDF desta página"
              >
                <X className="w-3 h-3" />
                <span>Remover PDF</span>
              </button>
            </div>
          )}
          {page.hideTitle && (
            <button
              type="button"
              onClick={() => onUpdatePage({ hideTitle: false })}
              className="inline-flex items-center gap-1 rounded-md bg-white/90 dark:bg-slate-900/90 px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 shadow-xs backdrop-blur-xs cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Título</span>
            </button>
          )}
        </div>
      )}

      {/* Optional Closable Page Title */}
      {!page.hideTitle && (
        <div className="group/title relative z-10 flex items-center gap-2 mb-6">
          <input
            type="text"
            value={page.title}
            onChange={(e) => onUpdatePage({ title: e.target.value })}
            placeholder="Título da página"
            className="w-full bg-transparent font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--sheet-ink)] placeholder:text-[var(--sheet-placeholder)] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => onUpdatePage({ hideTitle: true, title: '' })}
            className="no-print shrink-0 p-1.5 rounded-lg opacity-50 group-hover/title:opacity-100 focus-visible:opacity-100 hover:text-rose-500 transition-all cursor-pointer"
            style={{ color: 'var(--sheet-ink-muted)' }}
            title="Fechar campo de título"
            aria-label="Fechar campo de título"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Blocks Stream */}
      <div className="relative z-10 flex-1 space-y-1.5">
        {page.blocks.map((block, index) => {
          if (block.type === 'numbered') {
            numberedCounter += 1;
          } else {
            numberedCounter = 0;
          }

          return (
            <BlockItem
              key={block.id}
              block={block}
              numberedIndex={numberedCounter}
              isFirst={index === 0}
              isLast={index === page.blocks.length - 1}
              autoFocus={focusedBlockId === block.id}
              penTool={penTool}
              penColor={penColor}
              penWidth={penWidth}
              isSheetDark={isSheetDark}
              onUpdate={(patch) => onUpdateBlock(block.id, patch)}
              onConvertType={(newType) => onConvertBlockType(block.id, newType)}
              onInsertAfter={(type) => onInsertAfter(block.id, type)}
              onDelete={() => onDeleteBlock(block.id)}
              onMove={(dir) => onMoveBlock(block.id, dir)}
              onRunOcr={onRunOcr}
              isOcrLoading={isOcrLoading}
            />
          );
        })}
      </div>

      {/* App-only Watermark Page Number in Bottom-Right Footer (hidden on print/export) */}
      <div className="no-print relative z-10 mt-auto pt-4 flex justify-end pointer-events-none select-none">
        <span
          className={`tabular-nums text-[11px] font-medium tracking-wider ${
            isSheetDark ? 'text-slate-400/40' : 'text-slate-500/45'
          }`}
        >
          {pageNumber}/{totalPages}
        </span>
      </div>
    </div>
  );
};
