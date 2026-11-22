import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Columns2,
  Download,
  Eraser,
  FileCode2,
  FileJson,
  FilePlus2,
  FileText,
  FileUp,
  GalleryHorizontalEnd,
  GalleryVerticalEnd,
  Highlighter,
  ImagePlus,
  Keyboard,
  Layers,
  LayoutGrid,
  ListChecks,
  Loader2,
  Mic,
  Minus,
  Pen,
  PenTool,
  Plus,
  Printer,
  Redo2,
  Ruler,
  ScanText,
  SlidersHorizontal,
  Sparkles,
  Star,
  Table,
  Trash2,
  Undo2,
  Wand2,
  X,
} from 'lucide-react';
import {
  DEFAULT_PAGE_FORMAT,
  PAGE_COLOR_SWATCHES,
  PAGE_FORMAT_PRESETS,
  type BlockType,
  type DrawingStroke,
  type NoteBlock,
  type NotePage,
  type PageBackgroundColor,
  type PageFormat,
  type PaperStyle,
  type PenTool as PenToolType,
  type ScrollDirection,
} from '../../types/notes';
import { createDefaultBlock, useNotesStore } from '../../store/useNotesStore';
import {
  extractTasksWithAI,
  normalizeAiBlockType,
  ocrImageWithAI,
  organizePageWithAI,
  summarizePageWithAI,
} from '../../services/ai/aiService';
import {
  exportPageToDocx,
  exportPageToMarkdown,
  exportPageToPdf,
  exportPagesAsLayeredPdf,
  exportWorkspaceBackupJson,
} from '../../services/export/exportService';
import { exportDrawingToPngDataUrl } from '../../utils/canvasRender';
import { extractPdfPages } from '../../services/pdf/pdfImportService';
import type { PageInkOverlayHandle } from '../canvas/PageInkOverlay';
import { PageSheet } from './PageSheet';

const PAPER_STYLES: Array<{ id: PaperStyle; label: string }> = [
  { id: 'plain', label: 'Liso' },
  { id: 'ruled', label: 'Pautado' },
  { id: 'grid', label: 'Quadriculado' },
  { id: 'dotted', label: 'Pontilhado' },
];

const QUICK_COLORS_STORAGE_KEY = 'folionotes_quick_colors_v1';

const DEFAULT_QUICK_COLORS = ['#0F172A', '#DC2626', '#2563EB', '#FACC15'];

const FULL_COLOR_PALETTE: Array<{ label: string; value: string }> = [
  { label: 'Preto / Adaptativo', value: '#0F172A' },
  { label: 'Grafite', value: '#475569' },
  { label: 'Cinza Claro', value: '#94A3B8' },
  { label: 'Branco', value: '#FFFFFF' },
  { label: 'Marrom', value: '#78350F' },
  { label: 'Terracota', value: '#C2410C' },
  { label: 'Vermelho', value: '#DC2626' },
  { label: 'Vinho', value: '#9F1239' },
  { label: 'Rosa Intenso', value: '#DB2777' },
  { label: 'Rosa Suave', value: '#F472B6' },
  { label: 'Laranja', value: '#EA580C' },
  { label: 'Âmbar', value: '#D97706' },
  { label: 'Amarelo Marca-Texto', value: '#FACC15' },
  { label: 'Lima', value: '#84CC16' },
  { label: 'Verde Esmeralda', value: '#059669' },
  { label: 'Verde Floresta', value: '#15803D' },
  { label: 'Turquesa', value: '#0D9488' },
  { label: 'Ciano', value: '#06B6D4' },
  { label: 'Azul Celeste', value: '#38BDF8' },
  { label: 'Azul Royal', value: '#2563EB' },
  { label: 'Azul Marinho', value: '#1E3A8A' },
  { label: 'Índigo', value: '#6366F1' },
  { label: 'Roxo', value: '#7C3AED' },
  { label: 'Violeta', value: '#A855F7' },
];

const PEN_THICKNESS_STORAGE_KEY = 'folionotes_pen_thickness_v1';

const PEN_WIDTH_PRESETS = [1, 2.5, 4, 7, 12];
const HIGHLIGHTER_WIDTH_PRESETS = [10, 16, 22, 30, 42];

const SCROLL_DIRECTION_OPTIONS: Array<{
  id: ScrollDirection;
  label: string;
  Icon: React.FC<{ className?: string }>;
}> = [
  { id: 'vertical', label: 'Vertical', Icon: GalleryVerticalEnd },
  { id: 'horizontal', label: 'Horizontal', Icon: GalleryHorizontalEnd },
  { id: 'two-page', label: 'Horizontal em 2 páginas', Icon: Columns2 },
];

export const NoteEditor: React.FC = () => {
  const {
    state,
    activeNotebook,
    activeSection,
    activePage,
    selectPage,
    updatePage,
    setSectionPageColor,
    setScrollDirection,
    setPaperStyle,
    softDeletePage,
    createPage,
    insertPdfPages,
    updateBlock,
    insertBlockAfter,
    prependBlocks,
    appendBlocks,
    replaceBlocks,
    deleteBlock,
    moveBlock,
  } = useNotesStore();

  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [isInkMode, setIsInkMode] = useState(false);
  const [penTool, setPenTool] = useState<PenToolType>('fountain');
  const [penColor, setPenColor] = useState<string>('#0F172A');
  const [penWidth, setPenWidth] = useState<number>(() => {
    try {
      const saved = window.localStorage.getItem(PEN_THICKNESS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.pen === 'number' && parsed.pen >= 0.5 && parsed.pen <= 24) {
          return parsed.pen;
        }
      }
    } catch {
      // ignore storage errors
    }
    return 3.5;
  });
  const [highlighterWidth, setHighlighterWidth] = useState<number>(() => {
    try {
      const saved = window.localStorage.getItem(PEN_THICKNESS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.highlighter === 'number' && parsed.highlighter >= 8 && parsed.highlighter <= 48) {
          return parsed.highlighter;
        }
      }
    } catch {
      // ignore storage errors
    }
    return 18;
  });
  const [eraserWidth, setEraserWidth] = useState<number>(() => {
    try {
      const saved = window.localStorage.getItem(PEN_THICKNESS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.eraser === 'number' && parsed.eraser >= 8 && parsed.eraser <= 48) {
          return parsed.eraser;
        }
      }
    } catch {
      // ignore storage errors
    }
    return 18;
  });
  const [quickColors, setQuickColors] = useState<string[]>(() => {
    try {
      const saved = window.localStorage.getItem(QUICK_COLORS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((c) => typeof c === 'string')) {
          return parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_QUICK_COLORS;
  });
  const [inkRedoByPage, setInkRedoByPage] = useState<Record<string, DrawingStroke[]>>({});

  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const [showInsertMenu, setShowInsertMenu] = useState(false);
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [showThicknessMenu, setShowThicknessMenu] = useState(false);
  const [showPageSettingsMenu, setShowPageSettingsMenu] = useState(false);
  const [showAiMenu, setShowAiMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [customWidthDraft, setCustomWidthDraft] = useState('210');
  const [customHeightDraft, setCustomHeightDraft] = useState('297');
  const [aiLoadingAction, setAiLoadingAction] = useState<string | null>(null);
  const [pdfImportProgress, setPdfImportProgress] = useState<string | null>(null);
  const [pdfExportProgress, setPdfExportProgress] = useState<string | null>(null);
  const [isDraggingPdf, setIsDraggingPdf] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const ocrFileInputRef = useRef<HTMLInputElement | null>(null);
  const pdfFileInputRef = useRef<HTMLInputElement | null>(null);
  const sheetElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const inkOverlaysRef = useRef<Map<string, PageInkOverlayHandle>>(new Map());
  const internalActivationRef = useRef<string | null>(null);

  const scrollDirection: ScrollDirection = state.scrollDirection ?? 'vertical';

  const orderedSectionPages = useMemo<NotePage[]>(() => {
    if (!activeSection) return activePage ? [activePage] : [];
    const secPages = state.pages.filter((p) => p.sectionId === activeSection.id && !p.isDeleted);
    const idSet = new Set(secPages.map((p) => p.id));
    const topLevel = secPages.filter((p) => !p.parentId || !idSet.has(p.parentId));
    const ordered: NotePage[] = [];
    for (const pg of topLevel) {
      ordered.push(pg);
      const children = secPages.filter((sub) => sub.parentId === pg.id);
      ordered.push(...children);
    }
    if (activePage && !ordered.some((p) => p.id === activePage.id)) {
      ordered.push(activePage);
    }
    return ordered;
  }, [state.pages, activeSection, activePage]);

  const twoPageSpreads = useMemo<NotePage[][]>(() => {
    const pairs: NotePage[][] = [];
    for (let i = 0; i < orderedSectionPages.length; i += 2) {
      pairs.push(orderedSectionPages.slice(i, i + 2));
    }
    return pairs;
  }, [orderedSectionPages]);

  useEffect(() => {
    const fmt = activePage?.pageFormat ?? DEFAULT_PAGE_FORMAT;
    setCustomWidthDraft(String(fmt.widthMm));
    setCustomHeightDraft(String(fmt.heightMm));
  }, [activePage?.id, activePage?.pageFormat?.preset, activePage?.pageFormat?.widthMm, activePage?.pageFormat?.heightMm]);

  useEffect(() => {
    const activeId = activePage?.id;
    if (!activeId) return;
    if (internalActivationRef.current === activeId) {
      internalActivationRef.current = null;
      return;
    }
    const raf = window.requestAnimationFrame(() => {
      const el = sheetElementsRef.current.get(activeId);
      el?.scrollIntoView({
        behavior: 'smooth',
        block: scrollDirection === 'vertical' ? 'start' : 'nearest',
        inline: scrollDirection === 'vertical' ? 'nearest' : 'center',
      });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [activePage?.id, scrollDirection]);

  useEffect(() => {
    try {
      window.localStorage.setItem(QUICK_COLORS_STORAGE_KEY, JSON.stringify(quickColors));
    } catch {
      // ignore storage errors
    }
  }, [quickColors]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PEN_THICKNESS_STORAGE_KEY,
        JSON.stringify({ pen: penWidth, highlighter: highlighterWidth, eraser: eraserWidth })
      );
    } catch {
      // ignore storage errors
    }
  }, [penWidth, highlighterWidth, eraserWidth]);

  const handleImportPdfFile = async (file: File) => {
    if (!activeSection) return;
    setAiFeedback(null);
    setPdfImportProgress('Carregando documento PDF...');
    try {
      const extracted = await extractPdfPages(file, (curr, total) => {
        setPdfImportProgress(`Carregando PDF (${curr} de ${total} páginas)...`);
      });
      if (extracted.length === 0) {
        setAiFeedback({ type: 'error', text: 'Nenhuma página encontrada no PDF selecionado.' });
        return;
      }
      insertPdfPages(activeSection.id, activePage?.id ?? null, file.name, extracted);
      setIsInkMode(true);
      setAiFeedback({
        type: 'success',
        text: `${extracted.length} ${extracted.length === 1 ? 'página de PDF carregada' : 'páginas de PDF carregadas'}. Use a caneta para escrever ou o marca-texto sobre o texto do PDF.`,
      });
    } catch (error) {
      setAiFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao processar documento PDF.',
      });
    } finally {
      setPdfImportProgress(null);
    }
  };

  const handlePdfInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleImportPdfFile(file);
    }
    e.target.value = '';
  };

  const handleExportLayeredPdf = async (scope: 'current' | 'section') => {
    if (!activePage) return;
    setShowExportMenu(false);
    setAiFeedback(null);

    const pagesToExport = scope === 'section' ? orderedSectionPages : [activePage];
    if (pagesToExport.length === 0) return;

    const sheetAspectRatios: Record<string, number> = {};
    for (const pg of pagesToExport) {
      const el = sheetElementsRef.current.get(pg.id);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          sheetAspectRatios[pg.id] = rect.height / rect.width;
        }
      }
    }

    const baseName =
      scope === 'section'
        ? activeSection?.name || activePage.title || 'secao'
        : activePage.title.trim() ||
          activePage.pdfBackground?.fileName?.replace(/\.pdf$/i, '') ||
          activeSection?.name ||
          'nota';

    setPdfExportProgress('Gerando PDF com camadas...');
    try {
      await exportPagesAsLayeredPdf(pagesToExport, {
        baseName,
        appTheme: state.theme,
        sheetAspectRatios,
        onProgress: (curr, total) => {
          setPdfExportProgress(
            total > 1 ? `Gerando PDF com camadas (${curr}/${total})...` : 'Gerando PDF com camadas...'
          );
        },
      });
      setAiFeedback({
        type: 'success',
        text:
          pagesToExport.length > 1
            ? `PDF exportado com ${pagesToExport.length} páginas e camadas preservadas (Papel/PDF, Texto, Marca-texto e Anotações).`
            : 'PDF da nota exportado com camadas preservadas (Papel/PDF, Texto, Marca-texto e Anotações).',
      });
    } catch (error) {
      setAiFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao exportar PDF com camadas.',
      });
    } finally {
      setPdfExportProgress(null);
    }
  };

  if (!activePage) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <input
          ref={pdfFileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handlePdfInputChange}
          className="hidden"
        />
        <div className="max-w-sm space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500">
            <FileText className="w-6 h-6" />
          </div>
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
            Nenhuma página selecionada
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Selecione uma nota na barra lateral, crie uma nova página ou faça upload de um documento PDF nesta seção.
          </p>
          {activeSection && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => createPage(activeSection.id, null, '')}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Nova Página</span>
              </button>
              <button
                type="button"
                onClick={() => pdfFileInputRef.current?.click()}
                disabled={!!pdfImportProgress}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <FileUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Upload de PDF</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const closeAllMenus = () => {
    setShowInsertMenu(false);
    setShowFormatMenu(false);
    setShowColorMenu(false);
    setShowThicknessMenu(false);
    setShowPageSettingsMenu(false);
    setShowAiMenu(false);
    setShowExportMenu(false);
  };

  const handleToggleQuickColor = (hex: string) => {
    const normalized = hex.toUpperCase();
    setQuickColors((prev) => {
      const exists = prev.some((c) => c.toUpperCase() === normalized);
      if (exists) {
        if (prev.length <= 1) return prev;
        return prev.filter((c) => c.toUpperCase() !== normalized);
      }
      return [...prev, normalized];
    });
  };

  const handleActivateSheet = (pageId: string) => {
    if (pageId === activePage.id) return;
    internalActivationRef.current = pageId;
    selectPage(pageId);
  };

  const handleSelectPenTool = (next: PenToolType) => {
    setPenTool(next);
    setIsInkMode(true);
    if (next === 'highlighter') {
      setPenColor('#FACC15');
    } else if (penColor === '#FACC15') {
      setPenColor('#0F172A');
    }
  };

  const handleSelectPenColor = (value: string) => {
    setPenColor(value);
    if (penTool === 'eraser') {
      setPenTool('fountain');
    }
    if (!isInkMode) {
      setIsInkMode(true);
    }
  };

  const activeInkStrokes = activePage.inkStrokes ?? [];
  const activeRedoStrokes = inkRedoByPage[activePage.id] ?? [];

  const handleInkUndo = () => {
    if (activeInkStrokes.length === 0) return;
    const last = activeInkStrokes[activeInkStrokes.length - 1];
    setInkRedoByPage((prev) => ({
      ...prev,
      [activePage.id]: [...(prev[activePage.id] ?? []), last],
    }));
    updatePage(activePage.id, { inkStrokes: activeInkStrokes.slice(0, -1) });
  };

  const handleInkRedo = () => {
    if (activeRedoStrokes.length === 0) return;
    const restored = activeRedoStrokes[activeRedoStrokes.length - 1];
    setInkRedoByPage((prev) => ({
      ...prev,
      [activePage.id]: (prev[activePage.id] ?? []).slice(0, -1),
    }));
    updatePage(activePage.id, { inkStrokes: [...activeInkStrokes, restored] });
  };

  const handleInkClear = () => {
    if (activeInkStrokes.length === 0) return;
    setInkRedoByPage((prev) => ({ ...prev, [activePage.id]: [] }));
    updatePage(activePage.id, { inkStrokes: [] });
  };

  const handlePageInkChange = (pageId: string, nextStrokes: DrawingStroke[]) => {
    setInkRedoByPage((prev) => {
      if (!prev[pageId]?.length) return prev;
      return { ...prev, [pageId]: [] };
    });
    updatePage(pageId, { inkStrokes: nextStrokes });
  };

  const handleConvertBlockType = (pageId: string, blockId: string, newType: BlockType) => {
    const template = createDefaultBlock(newType, '');
    updateBlock(pageId, blockId, {
      ...template,
      id: blockId,
    });
    setFocusedBlockId(blockId);
  };

  const handleInsertAfter = (pageId: string, afterBlockId: string | null, type: BlockType) => {
    const newBlock = createDefaultBlock(type, '');
    insertBlockAfter(pageId, afterBlockId, newBlock);
    setFocusedBlockId(newBlock.id);
  };

  const handleQuickInsertAtEnd = (pageId: string, type: BlockType) => {
    const newBlock = createDefaultBlock(type, '');
    appendBlocks(pageId, [newBlock]);
    setFocusedBlockId(newBlock.id);
    setIsInkMode(false);
  };

  const handleAiSummarize = async () => {
    setShowAiMenu(false);
    setAiFeedback(null);
    setAiLoadingAction('Resumindo página...');
    try {
      const result = await summarizePageWithAI(activePage.title, activePage.blocks);
      const summaryText = `${result.summaryTitle}\n${result.bullets.map((b) => `• ${b}`).join('\n')}`;
      const summaryBlock: NoteBlock = {
        ...createDefaultBlock('callout', summaryText),
        calloutTone: 'tip',
      };
      prependBlocks(activePage.id, [summaryBlock]);
      setAiFeedback({ type: 'success', text: 'Resumo estruturado inserido no topo da página.' });
    } catch (error) {
      setAiFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Erro ao resumir.' });
    } finally {
      setAiLoadingAction(null);
    }
  };

  const handleAiOrganize = async () => {
    setShowAiMenu(false);
    setAiFeedback(null);
    setAiLoadingAction('Organizando e revisando...');
    try {
      const result = await organizePageWithAI(activePage.title, activePage.blocks);
      const mediaBlocks = activePage.blocks.filter((b) => ['drawing', 'image', 'audio', 'table', 'link'].includes(b.type));
      const newTextBlocks: NoteBlock[] = result.blocks.map((item) =>
        createDefaultBlock(normalizeAiBlockType(item.type), item.content)
      );
      if (newTextBlocks.length > 0) {
        replaceBlocks(activePage.id, [...newTextBlocks, ...mediaBlocks]);
        setAiFeedback({ type: 'success', text: 'Texto revisado e organizado em tópicos.' });
      }
    } catch (error) {
      setAiFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Erro ao organizar.' });
    } finally {
      setAiLoadingAction(null);
    }
  };

  const handleAiExtractTasks = async () => {
    setShowAiMenu(false);
    setAiFeedback(null);
    setAiLoadingAction('Extraindo tarefas...');
    try {
      const result = await extractTasksWithAI(activePage.title, activePage.blocks);
      if (!result.tasks || result.tasks.length === 0) {
        setAiFeedback({ type: 'error', text: 'Nenhuma ação prática encontrada no texto.' });
        return;
      }
      const heading = createDefaultBlock('h3', 'Lista de Tarefas (IA)');
      const taskBlocks = result.tasks.map((task) => createDefaultBlock('checklist', task));
      appendBlocks(activePage.id, [heading, ...taskBlocks]);
      setAiFeedback({ type: 'success', text: `${taskBlocks.length} tarefas adicionadas à nota.` });
    } catch (error) {
      setAiFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Erro ao gerar tarefas.' });
    } finally {
      setAiLoadingAction(null);
    }
  };

  const handleRunOcr = async (imageDataUrl: string) => {
    setShowOcrModal(false);
    setShowAiMenu(false);
    setAiFeedback(null);
    setAiLoadingAction('Convertendo rascunho/imagem em texto...');
    try {
      const result = await ocrImageWithAI(imageDataUrl, activePage.title);
      const convertedBlocks: NoteBlock[] = (result.blocks || []).map((item) =>
        createDefaultBlock(normalizeAiBlockType(item.type), item.content)
      );
      if (convertedBlocks.length === 0) {
        setAiFeedback({ type: 'error', text: 'Nenhum texto reconhecido na imagem selecionada.' });
        return;
      }
      const header = createDefaultBlock('h3', 'Transcrição OCR (IA)');
      appendBlocks(activePage.id, [header, ...convertedBlocks]);
      setAiFeedback({ type: 'success', text: 'Conteúdo visual convertido em blocos editáveis!' });
    } catch (error) {
      setAiFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Erro no OCR inteligente.' });
    } finally {
      setAiLoadingAction(null);
    }
  };

  const handleOcrUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const url = typeof reader.result === 'string' ? reader.result : '';
      if (url) handleRunOcr(url);
    };
    reader.readAsDataURL(file);
  };

  const visualSources = activePage.blocks.filter(
    (b) =>
      (b.type === 'drawing' && b.drawing && b.drawing.strokes.length > 0) ||
      (b.type === 'image' && b.image?.url.startsWith('data:image/'))
  );

  const contextLabel = [activeNotebook?.title, activeSection?.name].filter(Boolean).join(' · ');
  const activeFormat: PageFormat = activePage.pageFormat ?? DEFAULT_PAGE_FORMAT;
  const activePageColor: PageBackgroundColor = activePage.pageColor ?? 'auto';
  const isActiveSheetDark =
    activePageColor === 'black' || (activePageColor === 'auto' && state.theme === 'dark');

  const clampMm = (val: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(val)));

  const handleSelectFormatPreset = (preset: Exclude<PageFormat['preset'], 'Custom'>, widthMm: number, heightMm: number) => {
    updatePage(activePage.id, {
      pageFormat: { preset, widthMm, heightMm },
    });
    setCustomWidthDraft(String(widthMm));
    setCustomHeightDraft(String(heightMm));
  };

  const handleCustomDimensionChange = (axis: 'width' | 'height', raw: string) => {
    if (axis === 'width') setCustomWidthDraft(raw);
    else setCustomHeightDraft(raw);

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 80) return;

    const nextWidth = axis === 'width' ? clampMm(parsed, 80, 420) : activeFormat.widthMm;
    const nextHeight = axis === 'height' ? clampMm(parsed, 80, 600) : activeFormat.heightMm;

    updatePage(activePage.id, {
      pageFormat: {
        preset: 'Custom',
        widthMm: nextWidth,
        heightMm: nextHeight,
      },
    });
  };

  const commitCustomDimensions = () => {
    const parsedW = Number(customWidthDraft);
    const parsedH = Number(customHeightDraft);
    const nextW = Number.isFinite(parsedW) && parsedW > 0 ? clampMm(parsedW, 80, 420) : activeFormat.widthMm;
    const nextH = Number.isFinite(parsedH) && parsedH > 0 ? clampMm(parsedH, 80, 600) : activeFormat.heightMm;
    setCustomWidthDraft(String(nextW));
    setCustomHeightDraft(String(nextH));
    updatePage(activePage.id, {
      pageFormat: {
        preset: 'Custom',
        widthMm: nextW,
        heightMm: nextH,
      },
    });
  };

  const handleSelectPageColor = (colorId: PageBackgroundColor) => {
    if (activeSection) {
      setSectionPageColor(activeSection.id, colorId);
    } else {
      updatePage(activePage.id, { pageColor: colorId });
    }
  };

  const handleCreateNewPage = () => {
    if (!activeSection) return;
    const lastPage = orderedSectionPages[orderedSectionPages.length - 1] ?? activePage;
    createPage(
      activeSection.id,
      null,
      '',
      lastPage.paperStyle,
      lastPage.pageFormat,
      lastPage.pageColor ?? 'auto'
    );
  };

  const renderSheet = (pg: NotePage, pageIndex: number) => (
    <PageSheet
      key={pg.id}
      page={pg}
      pageNumber={pageIndex + 1}
      totalPages={orderedSectionPages.length}
      appTheme={state.theme}
      isActive={pg.id === activePage.id}
      isInkMode={isInkMode}
      penTool={penTool}
      penColor={penColor}
      penWidth={penWidth}
      highlighterWidth={highlighterWidth}
      eraserWidth={eraserWidth}
      isHorizontalLayout={scrollDirection !== 'vertical'}
      isOcrLoading={!!aiLoadingAction}
      focusedBlockId={focusedBlockId}
      onActivate={() => handleActivateSheet(pg.id)}
      onUpdatePage={(patch) => {
        if (patch.inkStrokes !== undefined && Object.keys(patch).length === 1) {
          handlePageInkChange(pg.id, patch.inkStrokes);
        } else {
          updatePage(pg.id, patch);
        }
      }}
      onUpdateBlock={(blockId, patch) => updateBlock(pg.id, blockId, patch)}
      onConvertBlockType={(blockId, newType) => handleConvertBlockType(pg.id, blockId, newType)}
      onInsertAfter={(afterBlockId, type) => handleInsertAfter(pg.id, afterBlockId, type)}
      onDeleteBlock={(blockId) => deleteBlock(pg.id, blockId)}
      onMoveBlock={(blockId, dir) => moveBlock(pg.id, blockId, dir)}
      onRunOcr={handleRunOcr}
      registerSheetElement={(el) => {
        if (el) sheetElementsRef.current.set(pg.id, el);
        else sheetElementsRef.current.delete(pg.id);
      }}
      registerInkOverlay={(handle) => {
        if (handle) inkOverlaysRef.current.set(pg.id, handle);
        else inkOverlaysRef.current.delete(pg.id);
      }}
    />
  );

  return (
    <div className="flex flex-1 flex-col min-w-0 h-full overflow-hidden">
      <input
        ref={pdfFileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={handlePdfInputChange}
        className="hidden"
      />
      {(showInsertMenu ||
        showFormatMenu ||
        showColorMenu ||
        showThicknessMenu ||
        showPageSettingsMenu ||
        showAiMenu ||
        showExportMenu) && (
        <div
          className="no-print fixed inset-0 z-20"
          onClick={closeAllMenus}
        />
      )}

      {/* Editor Top Toolbars (Row 1: Paper, Quick Insert, Format, AI, Export | Row 2: Fixed Samsung Notes Pen & Page Bar) */}
      {toolbarCollapsed ? (
        <div className="no-print flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 px-3 sm:px-6 py-1.5">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
            {activePage.title || 'Página sem título'}
          </span>
          <button
            type="button"
            onClick={() => setToolbarCollapsed(false)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer shrink-0"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            <span>Mostrar opções</span>
          </button>
        </div>
      ) : (
        <div className="no-print relative z-30 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/95 backdrop-blur-md">
          {/* Row 1: Primary Actions (as in Image 2) */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-6 py-2">
            {/* Paper Style Selector */}
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1 overflow-x-auto max-w-full">
              {PAPER_STYLES.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setPaperStyle(activePage.id, style.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activePage.paperStyle === style.id
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>

            {/* Right Controls: Quick Insert, Page Format, AI Assistant, Export, Favorite, Delete */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {/* Quick Insert Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    const next = !showInsertMenu;
                    closeAllMenus();
                    setShowInsertMenu(next);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title="Inserir rápido na folha"
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Inserir rápido</span>
                </button>

                {showInsertMenu && (
                  <div className="absolute left-0 sm:left-auto sm:right-0 top-full z-50 mt-1.5 w-52 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 shadow-xl">
                    <div className="px-2.5 py-1 text-[11px] font-medium text-slate-400">
                      Inserir bloco na página
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowInsertMenu(false);
                        handleQuickInsertAtEnd(activePage.id, 'paragraph');
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-slate-500" />
                      <span>Texto</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowInsertMenu(false);
                        handleQuickInsertAtEnd(activePage.id, 'checklist');
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <CheckSquare className="w-4 h-4 text-slate-500" />
                      <span>Tarefa</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowInsertMenu(false);
                        handleQuickInsertAtEnd(activePage.id, 'drawing');
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <PenTool className="w-4 h-4 text-slate-500" />
                      <span>Desenho</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowInsertMenu(false);
                        handleQuickInsertAtEnd(activePage.id, 'table');
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Table className="w-4 h-4 text-slate-500" />
                      <span>Tabela</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowInsertMenu(false);
                        handleQuickInsertAtEnd(activePage.id, 'audio');
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Mic className="w-4 h-4 text-slate-500" />
                      <span>Áudio</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowInsertMenu(false);
                        handleQuickInsertAtEnd(activePage.id, 'image');
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <ImagePlus className="w-4 h-4 text-slate-500" />
                      <span>Imagem</span>
                    </button>
                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                    <button
                      type="button"
                      onClick={() => {
                        setShowInsertMenu(false);
                        pdfFileInputRef.current?.click();
                      }}
                      disabled={!!pdfImportProgress}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 disabled:opacity-50 cursor-pointer"
                    >
                      <FileUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <div className="text-left">
                        <div>Upload de PDF (.pdf)</div>
                        <div className="text-[10px] font-normal text-slate-400">Escrever e grifar sobre o texto</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Direct PDF Document Upload Button */}
              <button
                type="button"
                onClick={() => {
                  closeAllMenus();
                  pdfFileInputRef.current?.click();
                }}
                disabled={!!pdfImportProgress}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Fazer upload de documento PDF (escreva com caneta e grife o texto com marca-texto)"
              >
                {pdfImportProgress ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <FileUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                )}
                <span>PDF</span>
              </button>

              {/* Page Format Dropdown (right before Assistente IA, defaults to A4) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    const next = !showFormatMenu;
                    closeAllMenus();
                    setShowFormatMenu(next);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title="Formato da página (padrão A4)"
                >
                  <Ruler className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span className="tabular-nums">
                    {activeFormat.preset === 'Custom'
                      ? `${activeFormat.widthMm}×${activeFormat.heightMm} mm`
                      : activeFormat.preset}
                  </span>
                </button>

                {showFormatMenu && (
                  <div className="absolute left-0 sm:left-auto sm:right-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-xl space-y-2">
                    <div className="px-2 py-0.5 text-[11px] font-medium text-slate-400">
                      Formato da página
                    </div>
                    <div className="space-y-0.5">
                      {PAGE_FORMAT_PRESETS.map((item) => {
                        const isSelected = activeFormat.preset === item.preset;
                        return (
                          <button
                            key={item.preset}
                            type="button"
                            onClick={() => {
                              handleSelectFormatPreset(item.preset, item.widthMm, item.heightMm);
                              setShowFormatMenu(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-200 font-semibold'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <Check className={`w-3.5 h-3.5 ${isSelected ? 'opacity-100 text-indigo-600 dark:text-indigo-400' : 'opacity-0'}`} />
                              <span>{item.label}</span>
                            </span>
                            <span className="text-[11px] text-slate-400 tabular-nums">
                              {item.widthMm} × {item.heightMm} mm
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-2 px-1.5 pb-1 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        <span>Tamanho editável (mm)</span>
                        {activeFormat.preset === 'Custom' && (
                          <span className="text-indigo-600 dark:text-indigo-400">Personalizado</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block">
                          <span className="block text-[10px] text-slate-400 mb-1">Largura (mm)</span>
                          <input
                            type="number"
                            min={80}
                            max={420}
                            value={customWidthDraft}
                            onChange={(e) => handleCustomDimensionChange('width', e.target.value)}
                            onBlur={commitCustomDimensions}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs tabular-nums text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </label>
                        <label className="block">
                          <span className="block text-[10px] text-slate-400 mb-1">Altura (mm)</span>
                          <input
                            type="number"
                            min={80}
                            max={600}
                            value={customHeightDraft}
                            onChange={(e) => handleCustomDimensionChange('height', e.target.value)}
                            onBlur={commitCustomDimensions}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs tabular-nums text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* AI Assistant Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    const next = !showAiMenu;
                    closeAllMenus();
                    setShowAiMenu(next);
                  }}
                  disabled={!!aiLoadingAction}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {aiLoadingAction ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>{aiLoadingAction ? 'Processando...' : 'Assistente IA'}</span>
                </button>

                {showAiMenu && (
                  <div className="absolute left-0 sm:left-auto sm:right-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 shadow-xl">
                    <div className="px-2.5 py-1 text-[11px] font-medium text-slate-400">
                      Recursos Gemini na página
                    </div>
                    <button
                      type="button"
                      onClick={handleAiSummarize}
                      className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <FileText className="w-4 h-4 mt-0.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <div>
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">Resumir Página</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">Cria tópicos no topo da nota</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={handleAiOrganize}
                      className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Wand2 className="w-4 h-4 mt-0.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <div>
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">Organizar e Revisar</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">Corrige gramática e estrutura seções</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={handleAiExtractTasks}
                      className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <ListChecks className="w-4 h-4 mt-0.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <div>
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">Gerar Lista de Tarefas</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">Extrai ações em checklist interativo</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAiMenu(false);
                        setShowOcrModal(true);
                      }}
                      className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <ScanText className="w-4 h-4 mt-0.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <div>
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">Converter Rascunho/Imagem (OCR)</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">Lê desenho do Canvas ou foto</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Export Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  disabled={!!pdfExportProgress}
                  onClick={() => {
                    const next = !showExportMenu;
                    closeAllMenus();
                    setShowExportMenu(next);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {pdfExportProgress ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>{pdfExportProgress ? 'Exportando...' : 'Exportar'}</span>
                </button>

                {showExportMenu && (
                  <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 shadow-xl">
                    <button
                      type="button"
                      onClick={() => void handleExportLayeredPdf('current')}
                      className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer"
                    >
                      <Layers className="w-4 h-4 mt-0.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <div>
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                          PDF com Camadas (.pdf)
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Salva a nota atual com texto, PDF, marca-texto e traços separados
                        </div>
                      </div>
                    </button>
                    {orderedSectionPages.length > 1 && (
                      <button
                        type="button"
                        onClick={() => void handleExportLayeredPdf('section')}
                        className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer"
                      >
                        <Layers className="w-4 h-4 mt-0.5 text-indigo-500 shrink-0" />
                        <div>
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                            PDF com Camadas — Seção ({orderedSectionPages.length} págs.)
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Exporta todas as folhas desta seção em um PDF
                          </div>
                        </div>
                      </button>
                    )}
                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                    <button
                      type="button"
                      onClick={() => {
                        setShowExportMenu(false);
                        exportPageToPdf();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Printer className="w-4 h-4 text-slate-500" />
                      <span>Imprimir (.pdf do navegador)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowExportMenu(false);
                        exportPageToMarkdown(activePage, contextLabel);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <FileCode2 className="w-4 h-4 text-slate-500" />
                      <span>Markdown (.md)</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setShowExportMenu(false);
                        await exportPageToDocx(activePage, contextLabel);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-slate-500" />
                      <span>Word (.docx)</span>
                    </button>
                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                    <button
                      type="button"
                      onClick={() => {
                        setShowExportMenu(false);
                        exportWorkspaceBackupJson(state);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <FileJson className="w-4 h-4 text-indigo-500" />
                      <span>Backup Completo (.json)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Favorite Toggle */}
              <button
                type="button"
                onClick={() => updatePage(activePage.id, { isFavorite: !activePage.isFavorite })}
                aria-label={activePage.isFavorite ? 'Remover dos favoritos' : 'Favoritar página'}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  activePage.isFavorite
                    ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-500'
                    : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:text-amber-500'
                }`}
                title="Favoritar nota"
              >
                <Star className={`w-4 h-4 ${activePage.isFavorite ? 'fill-current' : ''}`} />
              </button>

              {/* Move to Trash */}
              <button
                type="button"
                onClick={() => softDeletePage(activePage.id)}
                aria-label="Mover página para lixeira"
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 hover:border-rose-200 dark:hover:border-rose-900 transition-colors cursor-pointer"
                title="Mover para a lixeira"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* Collapse toolbar on mobile/tablet for maximum sheet space */}
              <button
                type="button"
                onClick={() => setToolbarCollapsed(true)}
                aria-label="Ocultar barra de opções"
                title="Ocultar barra de opções"
                className="lg:hidden p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Row 2: Fixed Always-Active Samsung Notes Pen & Page Settings Bar (as in Image 3) */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/95 dark:bg-slate-900/95 px-3 sm:px-6 py-1.5">
            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 max-w-full">
              {/* Keyboard / Text Mode */}
              <button
                type="button"
                onClick={() => setIsInkMode(false)}
                title="Modo Texto / Teclado"
                className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  !isInkMode
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                }`}
              >
                <Keyboard className="w-4 h-4" />
                <span className="hidden md:inline">Teclado</span>
              </button>

              <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />

              {/* Pen Tools */}
              <button
                type="button"
                onClick={() => handleSelectPenTool('fountain')}
                title="Caneta-tinteiro"
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isInkMode && penTool === 'fountain'
                    ? 'bg-slate-900 text-white dark:bg-indigo-600 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                }`}
              >
                <PenTool className="w-4 h-4" />
                <span className="hidden xl:inline">Tinteiro</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPenTool('ballpoint')}
                title="Caneta esferográfica"
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isInkMode && penTool === 'ballpoint'
                    ? 'bg-slate-900 text-white dark:bg-indigo-600 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                }`}
              >
                <Pen className="w-4 h-4" />
                <span className="hidden xl:inline">Esferográfica</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPenTool('highlighter')}
                title="Marca-texto"
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isInkMode && penTool === 'highlighter'
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                }`}
              >
                <Highlighter className="w-4 h-4" />
                <span className="hidden xl:inline">Marca-texto</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPenTool('eraser')}
                title="Borracha de traço"
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isInkMode && penTool === 'eraser'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                }`}
              >
                <Eraser className="w-4 h-4" />
                <span className="hidden xl:inline">Borracha</span>
              </button>

              <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />

              {/* Color Swatches (4 quick colors by default + "+" to pick or add more colors) */}
              <div className="relative flex items-center gap-1.5 px-0.5">
                {quickColors.map((hex) => {
                  const upper = hex.toUpperCase();
                  const displaySwatchColor =
                    upper === '#0F172A' && isActiveSheetDark ? '#F1F5F9' : hex;
                  const selected = penColor.toUpperCase() === upper && penTool !== 'eraser';
                  const paletteMeta = FULL_COLOR_PALETTE.find((c) => c.value.toUpperCase() === upper);
                  return (
                    <button
                      key={upper}
                      type="button"
                      onClick={() => handleSelectPenColor(hex)}
                      title={paletteMeta?.label ?? hex}
                      aria-label={paletteMeta?.label ?? hex}
                      className={`h-5 w-5 rounded-full border transition-transform shrink-0 cursor-pointer ${
                        selected
                          ? 'scale-110 ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900 border-white'
                          : 'border-slate-300 dark:border-slate-600 hover:scale-105'
                      }`}
                      style={{ backgroundColor: displaySwatchColor }}
                    />
                  );
                })}

                {(() => {
                  const isCustomActive =
                    penTool !== 'eraser' &&
                    !quickColors.some((c) => c.toUpperCase() === penColor.toUpperCase());
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        const next = !showColorMenu;
                        closeAllMenus();
                        setShowColorMenu(next);
                      }}
                      title="Mais cores / Adicionar cor à barra"
                      aria-label="Mais cores"
                      style={isCustomActive ? { backgroundColor: penColor } : undefined}
                      className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all shrink-0 cursor-pointer ${
                        isCustomActive
                          ? 'scale-110 ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900 border-white text-white shadow-xs'
                          : showColorMenu
                          ? 'border-dashed border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300'
                          : 'border-dashed border-slate-400 dark:border-slate-500 text-slate-500 dark:text-slate-400 hover:border-indigo-500 hover:text-indigo-600'
                      }`}
                    >
                      <Plus className="w-3 h-3 drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]" />
                    </button>
                  );
                })()}

                {showColorMenu && (
                  <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 shadow-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                        Paleta de cores
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuickColors(DEFAULT_QUICK_COLORS)}
                        className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        Restaurar 4 padrões
                      </button>
                    </div>

                    {/* 24 Curated Colors Grid */}
                    <div className="grid grid-cols-6 gap-2">
                      {FULL_COLOR_PALETTE.map((swatch) => {
                        const upper = swatch.value.toUpperCase();
                        const displayColor =
                          upper === '#0F172A' && isActiveSheetDark ? '#F1F5F9' : swatch.value;
                        const isSelected = penColor.toUpperCase() === upper && penTool !== 'eraser';
                        return (
                          <button
                            key={upper}
                            type="button"
                            onClick={() => handleSelectPenColor(swatch.value)}
                            title={swatch.label}
                            aria-label={swatch.label}
                            className={`flex h-7 w-7 items-center justify-center rounded-full border transition-transform cursor-pointer mx-auto ${
                              isSelected
                                ? 'scale-110 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 border-white'
                                : 'border-slate-300 dark:border-slate-600 hover:scale-110'
                            }`}
                            style={{ backgroundColor: displayColor }}
                          >
                            {isSelected && (
                              <Check
                                className={`w-3.5 h-3.5 stroke-[2.5] ${
                                  upper === '#FFFFFF' ||
                                  upper === '#FACC15' ||
                                  upper === '#84CC16' ||
                                  upper === '#38BDF8' ||
                                  upper === '#94A3B8' ||
                                  (upper === '#0F172A' && isActiveSheetDark)
                                    ? 'text-slate-900'
                                    : 'text-white'
                                }`}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Hex Picker & Pin to Quick Bar */}
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-2.5 flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                        <input
                          type="color"
                          value={penColor.startsWith('#') && penColor.length === 7 ? penColor : '#0F172A'}
                          onChange={(e) => handleSelectPenColor(e.target.value.toUpperCase())}
                          className="h-7 w-8 cursor-pointer rounded border border-slate-200 dark:border-slate-700 bg-transparent p-0.5"
                        />
                        <span>Cor personalizada</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => handleToggleQuickColor(penColor)}
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                          quickColors.some((c) => c.toUpperCase() === penColor.toUpperCase())
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                      >
                        {quickColors.some((c) => c.toUpperCase() === penColor.toUpperCase()) ? (
                          <>
                            <X className="w-3 h-3" />
                            <span>Remover da barra</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3" />
                            <span>Adicionar à barra</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />

              {/* Samsung Notes-style Tip Thickness Picker (slider + live preview + presets) */}
              {(() => {
                const isHl = penTool === 'highlighter';
                const isEr = penTool === 'eraser';
                const activeWidth = isHl ? highlighterWidth : isEr ? eraserWidth : penWidth;
                const minW = isHl || isEr ? 8 : 0.5;
                const maxW = isHl || isEr ? 48 : 24;
                const stepW = isHl ? 1 : isEr ? 2 : 0.5;
                const presets = isHl || isEr ? HIGHLIGHTER_WIDTH_PRESETS : PEN_WIDTH_PRESETS;
                const setWidth = (next: number) => {
                  const clamped = Math.max(minW, Math.min(maxW, Math.round(next * 2) / 2));
                  if (isHl) setHighlighterWidth(clamped);
                  else if (isEr) setEraserWidth(clamped);
                  else setPenWidth(clamped);
                  if (!isInkMode) setIsInkMode(true);
                };
                const toolTitle = isHl
                  ? 'Espessura do marca-texto'
                  : isEr
                  ? 'Tamanho da borracha'
                  : 'Espessura da ponta da caneta';
                const previewDotPx = Math.max(4, Math.min(14, isHl || isEr ? activeWidth / 3.2 : activeWidth * 1.1));
                const resolvedPreviewColor =
                  isEr
                    ? '#F43F5E'
                    : penColor.toUpperCase() === '#0F172A' && isActiveSheetDark
                    ? '#F1F5F9'
                    : penColor;

                return (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !showThicknessMenu;
                        closeAllMenus();
                        setShowThicknessMenu(next);
                      }}
                      title={toolTitle}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        showThicknessMenu
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-200'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span className="flex h-4 w-4 items-center justify-center">
                        <span
                          className="rounded-full transition-all"
                          style={{
                            width: `${previewDotPx}px`,
                            height: `${previewDotPx}px`,
                            backgroundColor: resolvedPreviewColor,
                            opacity: isHl ? 0.65 : 1,
                          }}
                        />
                      </span>
                      <span className="tabular-nums text-[11px]">{activeWidth}</span>
                    </button>

                    {showThicknessMenu && (
                      <div className="absolute left-0 sm:left-auto sm:right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-2xl space-y-3.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                            {toolTitle}
                          </span>
                          <span className="tabular-nums text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                            {activeWidth} px
                          </span>
                        </div>

                        {/* Live Stroke Preview (Samsung Notes style) */}
                        <div className="flex h-14 items-center justify-center rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-3 overflow-hidden">
                          {isEr ? (
                            <div
                              className="rounded-full border-2 border-rose-500/80 bg-rose-500/15 transition-all"
                              style={{
                                width: `${Math.min(44, activeWidth)}px`,
                                height: `${Math.min(44, activeWidth)}px`,
                              }}
                            />
                          ) : (
                            <svg viewBox="0 0 220 46" className="w-full h-11 overflow-visible">
                              <path
                                d="M 12 28 C 52 8, 92 40, 134 20 C 164 6, 188 28, 208 22"
                                fill="none"
                                stroke={resolvedPreviewColor}
                                strokeOpacity={isHl ? 0.42 : 0.96}
                                strokeWidth={Math.min(36, activeWidth)}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </div>

                        {/* Continuous Slider + Fine Stepper */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setWidth(activeWidth - stepW)}
                            disabled={activeWidth <= minW}
                            aria-label="Diminuir espessura"
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="range"
                            min={minW}
                            max={maxW}
                            step={stepW}
                            value={activeWidth}
                            onChange={(e) => setWidth(Number(e.target.value))}
                            aria-label={toolTitle}
                            className="flex-1 accent-indigo-600 cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => setWidth(activeWidth + stepW)}
                            disabled={activeWidth >= maxW}
                            aria-label="Aumentar espessura"
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* 5 Quick Preset Dots */}
                        <div className="flex items-center justify-between gap-1.5 pt-0.5">
                          {presets.map((preset) => {
                            const selected = Math.abs(activeWidth - preset) < 0.01;
                            const dotSize = Math.max(
                              5,
                              Math.min(20, isHl || isEr ? preset / 2.2 : preset * 1.45)
                            );
                            return (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setWidth(preset)}
                                title={`${preset} px`}
                                className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5 transition-colors cursor-pointer ${
                                  selected
                                    ? 'bg-indigo-50 dark:bg-indigo-950/60 ring-1 ring-indigo-500 text-indigo-700 dark:text-indigo-300'
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                <span className="flex h-5 items-center justify-center">
                                  <span
                                    className="rounded-full"
                                    style={{
                                      width: `${dotSize}px`,
                                      height: `${dotSize}px`,
                                      backgroundColor: resolvedPreviewColor,
                                      opacity: isHl ? 0.6 : 1,
                                    }}
                                  />
                                </span>
                                <span className="tabular-nums text-[10px] font-medium">{preset}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />

              {/* Undo / Redo / Clear / OCR */}
              <button
                type="button"
                onClick={handleInkUndo}
                disabled={activeInkStrokes.length === 0}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer shrink-0"
                title="Desfazer escrita na folha"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleInkRedo}
                disabled={activeRedoStrokes.length === 0}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer shrink-0"
                title="Refazer escrita na folha"
              >
                <Redo2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleInkClear}
                disabled={activeInkStrokes.length === 0}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-30 cursor-pointer shrink-0"
                title="Limpar escrita à mão desta folha"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {activeInkStrokes.length > 0 && (
                <button
                  type="button"
                  disabled={!!aiLoadingAction}
                  onClick={() => {
                    const dataUrl = inkOverlaysRef.current.get(activePage.id)?.exportPngDataUrl();
                    if (dataUrl) handleRunOcr(dataUrl);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                  title="Transcrever escrita da folha com Gemini OCR"
                >
                  <ScanText className="w-3.5 h-3.5" />
                  <span>OCR</span>
                </button>
              )}
            </div>

            {/* Right: Samsung Notes "Configurações de página" Popover Trigger (as in Image 3) */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  const next = !showPageSettingsMenu;
                  closeAllMenus();
                  setShowPageSettingsMenu(next);
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  showPageSettingsMenu
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-200'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title="Configurações de página (rolagem e cor de fundo)"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="hidden sm:inline">Config. página</span>
              </button>

              {showPageSettingsMenu && (
                <div className="absolute right-0 top-full z-50 mt-1.5 w-76 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-2xl space-y-4">
                  <div className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Configurações de página
                  </div>

                  {/* Scroll Direction (Vertical / Horizontal / Horizontal em 2 páginas) */}
                  <div className="space-y-1.5">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Direção da rolagem
                    </div>
                    <div className="space-y-1">
                      {SCROLL_DIRECTION_OPTIONS.map((opt) => {
                        const selected = scrollDirection === opt.id;
                        const OptIcon = opt.Icon;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setScrollDirection(opt.id)}
                            className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs transition-colors cursor-pointer ${
                              selected
                                ? 'bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-200 font-semibold'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span className="flex items-center gap-2.5">
                              <span
                                className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                                  selected
                                    ? 'border-indigo-600 dark:border-indigo-400'
                                    : 'border-slate-300 dark:border-slate-600'
                                }`}
                              >
                                {selected && (
                                  <span className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                                )}
                              </span>
                              <span>{opt.label}</span>
                            </span>
                            <OptIcon
                              className={`w-4 h-4 ${
                                selected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Page Background Color (Cor de fundo — Samsung Notes palette) */}
                  <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-500 dark:text-slate-400">Cor de fundo</span>
                      <span className="text-[11px] text-slate-400">
                        {PAGE_COLOR_SWATCHES.find((s) => s.id === activePageColor)?.label ?? 'Automático'}
                      </span>
                    </div>

                    <div className="grid grid-cols-6 gap-1.5 rounded-xl bg-slate-200/75 dark:bg-slate-800/80 p-1.5">
                      {PAGE_COLOR_SWATCHES.map((swatch) => {
                        const selected = activePageColor === swatch.id;
                        const isAuto = swatch.id === 'auto';
                        const isBlack = swatch.id === 'black';
                        return (
                          <button
                            key={swatch.id}
                            type="button"
                            onClick={() => handleSelectPageColor(swatch.id)}
                            title={swatch.label}
                            aria-label={swatch.label}
                            className={`relative flex h-9 items-center justify-center rounded-lg border transition-transform cursor-pointer ${
                              selected
                                ? 'scale-105 ring-2 ring-indigo-500 border-white dark:border-slate-900 shadow-sm z-10'
                                : 'border-slate-300/80 dark:border-slate-700 hover:scale-105'
                            }`}
                            style={
                              isAuto
                                ? {
                                    background:
                                      'linear-gradient(135deg, #ffffff 50%, #171c26 50%)',
                                  }
                                : { backgroundColor: swatch.lightHex }
                            }
                          >
                            {selected && (
                              <Check
                                className={`w-4 h-4 stroke-[2.5] ${
                                  isBlack || (isAuto && state.theme === 'dark')
                                    ? 'text-white'
                                    : isAuto
                                    ? 'text-indigo-600 drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)]'
                                    : 'text-slate-800'
                                }`}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PDF Import / Export Progress Banner */}
      {(pdfImportProgress || pdfExportProgress) && (
        <div className="no-print flex items-center gap-2.5 px-4 sm:px-6 py-2 text-xs font-medium border-b bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900 text-indigo-800 dark:text-indigo-200">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span>{pdfExportProgress || pdfImportProgress}</span>
        </div>
      )}

      {/* Inline AI Notification Banner */}
      {aiFeedback && (
        <div
          className={`no-print flex items-center justify-between gap-3 px-4 sm:px-6 py-2 text-xs font-medium border-b ${
            aiFeedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200'
          }`}
        >
          <span>{aiFeedback.text}</span>
          <button type="button" onClick={() => setAiFeedback(null)} className="p-0.5 hover:opacity-70 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Scrollable Sheet Canvas (Vertical, Horizontal, or Horizontal 2-Page Spread) */}
      <div
        data-editor-scroll="true"
        onDragOver={(e) => {
          if (e.dataTransfer?.types.includes('Files')) {
            e.preventDefault();
            setIsDraggingPdf(true);
          }
        }}
        onDragLeave={() => setIsDraggingPdf(false)}
        onDrop={(e) => {
          setIsDraggingPdf(false);
          const dropped = Array.from(e.dataTransfer?.files || []).find(
            (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
          );
          if (dropped) {
            e.preventDefault();
            void handleImportPdfFile(dropped);
          }
        }}
        className={`relative flex-1 scrollbar-thin bg-slate-100/80 dark:bg-slate-950 p-2.5 sm:p-6 lg:p-8 pb-12 ${
          scrollDirection === 'vertical'
            ? 'overflow-y-auto overflow-x-auto space-y-6'
            : 'overflow-x-auto overflow-y-auto flex flex-row items-start gap-6'
        } ${
          isDraggingPdf ? 'ring-2 ring-inset ring-indigo-500/60 bg-indigo-50/40 dark:bg-indigo-950/20' : ''
        }`}
      >
        {isDraggingPdf && (
          <div className="no-print pointer-events-none sticky top-4 z-40 mx-auto flex max-w-md items-center justify-center gap-2.5 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white/95 dark:bg-slate-900/95 px-4 py-3 text-xs font-semibold text-indigo-700 dark:text-indigo-200 shadow-lg backdrop-blur-sm">
            <FileUp className="w-4 h-4 shrink-0" />
            <span>Solte o documento PDF para carregar na nota</span>
          </div>
        )}
        {scrollDirection === 'two-page' ? (
          <>
            {twoPageSpreads.map((pair, pairIdx) => (
              <div key={pair[0].id} className="flex items-start gap-4 shrink-0">
                {pair.map((pg, offset) => renderSheet(pg, pairIdx * 2 + offset))}
              </div>
            ))}
          </>
        ) : (
          orderedSectionPages.map((pg, idx) => renderSheet(pg, idx))
        )}

        {/* Add New Page Below (or at the end in horizontal mode) */}
        {activeSection && (
          <div
            className={`no-print flex justify-center ${
              scrollDirection === 'vertical' ? 'pt-2' : 'shrink-0 self-center px-2'
            }`}
          >
            <button
              type="button"
              onClick={handleCreateNewPage}
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs font-semibold text-indigo-700 dark:text-indigo-200 shadow-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors whitespace-nowrap cursor-pointer"
            >
              <FilePlus2 className="w-4 h-4" />
              <span>Nova Página</span>
            </button>
          </div>
        )}
      </div>

      {/* Smart OCR Modal */}
      {showOcrModal && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                OCR Inteligente (Gemini)
              </h3>
              <button
                type="button"
                onClick={() => setShowOcrModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Escolha um bloco de rascunho/imagem desta nota ou envie uma foto de caderno ou quadro para transcrever em texto editável.
            </p>

            {((activePage.inkStrokes?.length ?? 0) > 0 || visualSources.length > 0) && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Escrita ou imagens nesta página:
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {(activePage.inkStrokes?.length ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const dataUrl = inkOverlaysRef.current.get(activePage.id)?.exportPngDataUrl();
                        if (dataUrl) handleRunOcr(dataUrl);
                      }}
                      className="flex w-full items-center justify-between rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 px-3 py-2.5 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <PenTool className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="truncate">Escrita livre direta na folha</span>
                      </span>
                      <span className="text-indigo-600 dark:text-indigo-400 shrink-0 ml-2">Converter</span>
                    </button>
                  )}
                  {visualSources.map((srcBlock, i) => (
                    <button
                      key={srcBlock.id}
                      type="button"
                      onClick={() => {
                        if (srcBlock.type === 'drawing' && srcBlock.drawing) {
                          const dataUrl = exportDrawingToPngDataUrl(
                            srcBlock.drawing.strokes,
                            840,
                            srcBlock.drawing.height || 270,
                            '#ffffff'
                          );
                          if (dataUrl) handleRunOcr(dataUrl);
                        } else if (srcBlock.type === 'image' && srcBlock.image?.url) {
                          handleRunOcr(srcBlock.image.url);
                        }
                      }}
                      className="flex w-full items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer"
                    >
                      <span className="flex items-center gap-2 truncate">
                        {srcBlock.type === 'drawing' ? (
                          <PenTool className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        ) : (
                          <LayoutGrid className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        )}
                        <span className="truncate">
                          {srcBlock.type === 'drawing'
                            ? srcBlock.content || `Desenho #${i + 1}`
                            : srcBlock.image?.caption || `Imagem #${i + 1}`}
                        </span>
                      </span>
                      <span className="text-indigo-600 dark:text-indigo-400 shrink-0 ml-2">Converter</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <input
              ref={ocrFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleOcrUploadFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => ocrFileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              <ImagePlus className="w-4 h-4" />
              <span>Enviar Foto para Transcrição</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
