import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_PAGE_FORMAT,
  type BlockType,
  type CoverPattern,
  type NoteBlock,
  type Notebook,
  type NotebookFolder,
  type NotebookSection,
  type NotePage,
  type PageBackgroundColor,
  type PageFormat,
  type PaperStyle,
  type PdfTextBox,
  type ScrollDirection,
  type WorkspaceState,
} from '../types/notes';
import { defaultStorageAdapter } from '../services/storage/LocalStorageAdapter';
import { createInitialWorkspaceState } from '../services/seed/welcomeNotebook';

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createDefaultBlock(type: BlockType, initialContent = ''): NoteBlock {
  const id = uid('blk');
  switch (type) {
    case 'table':
      return {
        id,
        type,
        content: initialContent || 'Tabela',
        table: {
          headers: ['Coluna 1', 'Coluna 2', 'Coluna 3'],
          rows: [
            ['', '', ''],
            ['', '', ''],
          ],
        },
      };
    case 'drawing':
      return {
        id,
        type,
        content: initialContent,
        drawing: {
          height: 260,
          strokes: [],
        },
      };
    case 'image':
      return {
        id,
        type,
        content: initialContent,
        image: {
          url: '',
          caption: '',
        },
      };
    case 'audio':
      return {
        id,
        type,
        content: initialContent,
      };
    case 'link':
      return {
        id,
        type,
        content: initialContent,
        link: {
          url: '',
          title: '',
          description: '',
        },
      };
    case 'checklist':
      return {
        id,
        type,
        content: initialContent,
        checked: false,
      };
    case 'callout':
      return {
        id,
        type,
        content: initialContent,
        calloutTone: 'info',
      };
    case 'code':
      return {
        id,
        type,
        content: initialContent,
        codeLanguage: 'Texto / Fórmula',
      };
    default:
      return {
        id,
        type,
        content: initialContent,
      };
  }
}

interface NotesContextValue {
  state: WorkspaceState;
  isLoaded: boolean;
  lastSavedAt: number | null;
  activeNotebook: Notebook | null;
  activeSection: NotebookSection | null;
  activePage: NotePage | null;
  shelfFolderId: string | null;
  setShelfFolderId: (folderId: string | null) => void;
  shelfNotebookId: string | null;
  setShelfNotebookId: (notebookId: string | null) => void;
  openFolderView: (folderId: string | null) => void;
  toggleTheme: () => void;
  setActiveView: (view: WorkspaceState['activeView']) => void;
  openNotebook: (notebookId: string) => void;
  openNotebookSections: (notebookId: string) => void;
  selectSection: (sectionId: string) => void;
  selectPage: (pageId: string) => void;
  createNotebook: (input: {
    title: string;
    description: string;
    coverColor: string;
    coverPattern: CoverPattern;
    folderId?: string | null;
  }) => void;
  updateNotebook: (notebookId: string, patch: Partial<Notebook>) => void;
  deleteNotebook: (notebookId: string) => void;
  createFolder: (name: string, color: string) => string;
  updateFolder: (folderId: string, patch: Partial<NotebookFolder>) => void;
  deleteFolder: (folderId: string) => void;
  moveNotebookToFolder: (notebookId: string, folderId: string | null) => void;
  createSection: (notebookId: string, name: string, color: string) => void;
  updateSection: (sectionId: string, patch: Partial<NotebookSection>) => void;
  deleteSection: (sectionId: string) => void;
  createPage: (
    sectionId: string,
    parentId?: string | null,
    title?: string,
    paperStyle?: PaperStyle,
    pageFormat?: PageFormat,
    pageColor?: PageBackgroundColor
  ) => string;
  insertPdfPages: (
    sectionId: string,
    targetPageId: string | null,
    fileName: string,
    pdfPages: Array<{
      pdfId: string;
      aspectRatio: number;
      widthMm: number;
      heightMm: number;
      pageNumber: number;
      totalPages: number;
      textBoxes?: PdfTextBox[];
    }>
  ) => void;
  updatePage: (pageId: string, patch: Partial<NotePage>) => void;
  setSectionPageColor: (sectionId: string, pageColor: PageBackgroundColor) => void;
  setScrollDirection: (direction: ScrollDirection) => void;
  softDeletePage: (pageId: string) => void;
  restorePage: (pageId: string) => void;
  permanentlyDeletePage: (pageId: string) => void;
  emptyTrash: () => void;
  updateBlock: (pageId: string, blockId: string, patch: Partial<NoteBlock>) => void;
  insertBlockAfter: (pageId: string, afterBlockId: string | null, block: NoteBlock) => void;
  prependBlocks: (pageId: string, blocks: NoteBlock[]) => void;
  appendBlocks: (pageId: string, blocks: NoteBlock[]) => void;
  replaceBlocks: (pageId: string, blocks: NoteBlock[]) => void;
  deleteBlock: (pageId: string, blockId: string) => void;
  moveBlock: (pageId: string, blockId: string, direction: 'up' | 'down') => void;
  importWorkspace: (newState: WorkspaceState) => void;
  setPaperStyle: (pageId: string, paperStyle: PaperStyle) => void;
}

const NotesContext = createContext<NotesContextValue | null>(null);

export const NotesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<WorkspaceState>(() => createInitialWorkspaceState());
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [shelfFolderId, setShelfFolderId] = useState<string | null>(null);
  const [shelfNotebookId, setShelfNotebookId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    defaultStorageAdapter.loadWorkspace().then((loaded) => {
      if (!mounted) return;
      if (loaded) {
        setState(loaded);
      }
      setIsLoaded(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.theme === 'dark');
  }, [state.theme]);

  useEffect(() => {
    if (!isLoaded) return;
    const timer = window.setTimeout(() => {
      defaultStorageAdapter.saveWorkspace(state).then(() => {
        setLastSavedAt(Date.now());
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [state, isLoaded]);

  const activeNotebook = useMemo(
    () => state.notebooks.find((n) => n.id === state.activeNotebookId) ?? state.notebooks[0] ?? null,
    [state.notebooks, state.activeNotebookId]
  );

  const activeSection = useMemo(() => {
    if (!activeNotebook) return null;
    const nbSections = state.sections.filter((s) => s.notebookId === activeNotebook.id);
    return nbSections.find((s) => s.id === state.activeSectionId) ?? nbSections[0] ?? null;
  }, [state.sections, state.activeSectionId, activeNotebook]);

  const activePage = useMemo(() => {
    if (!state.activePageId) return null;
    return state.pages.find((p) => p.id === state.activePageId && !p.isDeleted) ?? null;
  }, [state.pages, state.activePageId]);

  const toggleTheme = useCallback(() => {
    setState((prev) => ({
      ...prev,
      theme: prev.theme === 'light' ? 'dark' : 'light',
    }));
  }, []);

  const setActiveView = useCallback((view: WorkspaceState['activeView']) => {
    setState((prev) => ({ ...prev, activeView: view }));
  }, []);

  const openFolderView = useCallback((folderId: string | null) => {
    setShelfFolderId(folderId);
    setShelfNotebookId(null);
    setState((prev) => ({ ...prev, activeView: 'shelf' }));
  }, []);

  const openNotebook = useCallback((notebookId: string) => {
    setShelfNotebookId(null);
    setState((prev) => {
      const sections = prev.sections
        .filter((s) => s.notebookId === notebookId)
        .sort((a, b) => a.order - b.order);
      const firstSection = sections[0] ?? null;
      const firstPage = firstSection
        ? prev.pages.find((p) => p.sectionId === firstSection.id && !p.isDeleted) ?? null
        : null;
      return {
        ...prev,
        activeView: 'editor',
        activeNotebookId: notebookId,
        activeSectionId: firstSection?.id ?? null,
        activePageId: firstPage?.id ?? null,
      };
    });
  }, []);

  const openNotebookSections = useCallback((notebookId: string) => {
    setShelfNotebookId(notebookId);
    setState((prev) => {
      const sections = prev.sections
        .filter((s) => s.notebookId === notebookId)
        .sort((a, b) => a.order - b.order);
      const firstSection = sections[0] ?? null;
      const firstPage = firstSection
        ? prev.pages.find((p) => p.sectionId === firstSection.id && !p.isDeleted) ?? null
        : null;
      return {
        ...prev,
        activeView: 'shelf',
        activeNotebookId: notebookId,
        activeSectionId: firstSection?.id ?? null,
        activePageId: firstPage?.id ?? null,
      };
    });
  }, []);

  const selectSection = useCallback((sectionId: string) => {
    setShelfNotebookId(null);
    setState((prev) => {
      const section = prev.sections.find((s) => s.id === sectionId);
      if (!section) return prev;
      const firstPage = prev.pages.find((p) => p.sectionId === sectionId && !p.isDeleted) ?? null;
      return {
        ...prev,
        activeView: 'editor',
        activeNotebookId: section.notebookId,
        activeSectionId: sectionId,
        activePageId: firstPage?.id ?? null,
      };
    });
  }, []);

  const selectPage = useCallback((pageId: string) => {
    setShelfNotebookId(null);
    setState((prev) => {
      const page = prev.pages.find((p) => p.id === pageId && !p.isDeleted);
      if (!page) return prev;
      const section = prev.sections.find((s) => s.id === page.sectionId);
      return {
        ...prev,
        activeView: 'editor',
        activeNotebookId: section?.notebookId ?? prev.activeNotebookId,
        activeSectionId: page.sectionId,
        activePageId: page.id,
      };
    });
  }, []);

  const createNotebook = useCallback(
    (input: {
      title: string;
      description: string;
      coverColor: string;
      coverPattern: CoverPattern;
      folderId?: string | null;
    }) => {
      const now = Date.now();
      const notebookId = uid('nb');
      const sectionId = uid('sec');
      const pageId = uid('pg');

      const newNotebook: Notebook = {
        id: notebookId,
        folderId: input.folderId ?? null,
        title: input.title.trim() || 'Novo Caderno',
        description: input.description.trim(),
        coverColor: input.coverColor,
        coverPattern: input.coverPattern,
        isFavorite: false,
        createdAt: now,
        updatedAt: now,
      };

      const newSection: NotebookSection = {
        id: sectionId,
        notebookId,
        name: 'Seção Geral',
        color: input.coverColor,
        order: 0,
      };

      const newPage: NotePage = {
        id: pageId,
        sectionId,
        parentId: null,
        title: '',
        paperStyle: 'ruled',
        pageFormat: { ...DEFAULT_PAGE_FORMAT },
        isFavorite: false,
        isDeleted: false,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
        blocks: [createDefaultBlock('paragraph', '')],
      };

      setState((prev) => ({
        ...prev,
        notebooks: [newNotebook, ...prev.notebooks],
        sections: [...prev.sections, newSection],
        pages: [newPage, ...prev.pages],
        activeNotebookId: notebookId,
        activeSectionId: sectionId,
        activePageId: pageId,
        activeView: 'editor',
      }));
    },
    []
  );

  const updateNotebook = useCallback((notebookId: string, patch: Partial<Notebook>) => {
    setState((prev) => ({
      ...prev,
      notebooks: prev.notebooks.map((n) =>
        n.id === notebookId ? { ...n, ...patch, updatedAt: Date.now() } : n
      ),
    }));
  }, []);

  const deleteNotebook = useCallback((notebookId: string) => {
    setShelfNotebookId((prev) => (prev === notebookId ? null : prev));
    setState((prev) => {
      const remainingNotebooks = prev.notebooks.filter((n) => n.id !== notebookId);
      const removedSectionIds = new Set(prev.sections.filter((s) => s.notebookId === notebookId).map((s) => s.id));
      const remainingSections = prev.sections.filter((s) => s.notebookId !== notebookId);
      const remainingPages = prev.pages.filter((p) => !removedSectionIds.has(p.sectionId));

      const nextNb = remainingNotebooks[0] ?? null;
      const nextSec = nextNb ? remainingSections.find((s) => s.notebookId === nextNb.id) ?? null : null;
      const nextPage = nextSec ? remainingPages.find((p) => p.sectionId === nextSec.id && !p.isDeleted) ?? null : null;

      return {
        ...prev,
        notebooks: remainingNotebooks,
        sections: remainingSections,
        pages: remainingPages,
        activeNotebookId: prev.activeNotebookId === notebookId ? nextNb?.id ?? null : prev.activeNotebookId,
        activeSectionId: removedSectionIds.has(prev.activeSectionId ?? '') ? nextSec?.id ?? null : prev.activeSectionId,
        activePageId: prev.activePageId && !remainingPages.some((p) => p.id === prev.activePageId) ? nextPage?.id ?? null : prev.activePageId,
        activeView: remainingNotebooks.length === 0 ? 'shelf' : prev.activeView,
      };
    });
  }, []);

  const createFolder = useCallback((name: string, color: string): string => {
    const id = uid('fld');
    const folder: NotebookFolder = {
      id,
      name: name.trim() || 'Nova Pasta',
      color,
      createdAt: Date.now(),
    };
    setState((prev) => ({
      ...prev,
      folders: [folder, ...(prev.folders || [])],
    }));
    return id;
  }, []);

  const updateFolder = useCallback((folderId: string, patch: Partial<NotebookFolder>) => {
    setState((prev) => ({
      ...prev,
      folders: (prev.folders || []).map((f) => (f.id === folderId ? { ...f, ...patch } : f)),
    }));
  }, []);

  const deleteFolder = useCallback((folderId: string) => {
    setState((prev) => ({
      ...prev,
      folders: (prev.folders || []).filter((f) => f.id !== folderId),
      notebooks: prev.notebooks.map((nb) =>
        nb.folderId === folderId ? { ...nb, folderId: null } : nb
      ),
    }));
  }, []);

  const moveNotebookToFolder = useCallback((notebookId: string, folderId: string | null) => {
    setState((prev) => ({
      ...prev,
      notebooks: prev.notebooks.map((nb) =>
        nb.id === notebookId ? { ...nb, folderId, updatedAt: Date.now() } : nb
      ),
    }));
  }, []);

  const createSection = useCallback((notebookId: string, name: string, color: string) => {
    setShelfNotebookId(null);
    const now = Date.now();
    const sectionId = uid('sec');
    const pageId = uid('pg');

    setState((prev) => {
      const existingCount = prev.sections.filter((s) => s.notebookId === notebookId).length;
      const newSection: NotebookSection = {
        id: sectionId,
        notebookId,
        name: name.trim() || `Seção ${existingCount + 1}`,
        color,
        order: existingCount,
      };
      const newPage: NotePage = {
        id: pageId,
        sectionId,
        parentId: null,
        title: '',
        paperStyle: 'plain',
        pageFormat: { ...DEFAULT_PAGE_FORMAT },
        isFavorite: false,
        isDeleted: false,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
        blocks: [createDefaultBlock('paragraph', '')],
      };

      return {
        ...prev,
        sections: [...prev.sections, newSection],
        pages: [newPage, ...prev.pages],
        activeNotebookId: notebookId,
        activeSectionId: sectionId,
        activePageId: pageId,
        activeView: 'editor',
      };
    });
  }, []);

  const updateSection = useCallback((sectionId: string, patch: Partial<NotebookSection>) => {
    setState((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)),
    }));
  }, []);

  const deleteSection = useCallback((sectionId: string) => {
    setState((prev) => {
      const target = prev.sections.find((s) => s.id === sectionId);
      if (!target) return prev;
      const remainingSections = prev.sections.filter((s) => s.id !== sectionId);
      const remainingPages = prev.pages.filter((p) => p.sectionId !== sectionId);
      const fallbackSection = remainingSections.find((s) => s.notebookId === target.notebookId) ?? null;
      const fallbackPage = fallbackSection
        ? remainingPages.find((p) => p.sectionId === fallbackSection.id && !p.isDeleted) ?? null
        : null;

      return {
        ...prev,
        sections: remainingSections,
        pages: remainingPages,
        activeSectionId: prev.activeSectionId === sectionId ? fallbackSection?.id ?? null : prev.activeSectionId,
        activePageId: prev.activePageId && !remainingPages.some((p) => p.id === prev.activePageId) ? fallbackPage?.id ?? null : prev.activePageId,
      };
    });
  }, []);

  const createPage = useCallback(
    (
      sectionId: string,
      parentId: string | null = null,
      title = '',
      paperStyle: PaperStyle = 'ruled',
      pageFormat: PageFormat = DEFAULT_PAGE_FORMAT,
      pageColor: PageBackgroundColor = 'auto'
    ): string => {
      const now = Date.now();
      const pageId = uid('pg');
      const newPage: NotePage = {
        id: pageId,
        sectionId,
        parentId,
        title,
        paperStyle,
        pageFormat: { ...pageFormat },
        pageColor,
        isFavorite: false,
        isDeleted: false,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
        blocks: [createDefaultBlock('paragraph', '')],
      };

    setState((prev) => ({
      ...prev,
      pages: [...prev.pages, newPage],
      activeSectionId: sectionId,
      activePageId: pageId,
      activeView: 'editor',
    }));

    return pageId;
  }, []);

  const updatePage = useCallback((pageId: string, patch: Partial<NotePage>) => {
    setState((prev) => ({
      ...prev,
      pages: prev.pages.map((p) =>
        p.id === pageId ? { ...p, ...patch, updatedAt: Date.now() } : p
      ),
    }));
  }, []);

  const setSectionPageColor = useCallback((sectionId: string, pageColor: PageBackgroundColor) => {
    setState((prev) => ({
      ...prev,
      pages: prev.pages.map((p) =>
        p.sectionId === sectionId && !p.isDeleted
          ? { ...p, pageColor, updatedAt: Date.now() }
          : p
      ),
    }));
  }, []);

  const setScrollDirection = useCallback((scrollDirection: ScrollDirection) => {
    setState((prev) => ({
      ...prev,
      scrollDirection,
    }));
  }, []);

  const softDeletePage = useCallback((pageId: string) => {
    setState((prev) => {
      const now = Date.now();
      const targetPage = prev.pages.find((p) => p.id === pageId);
      const targetSectionId = targetPage?.sectionId ?? prev.activeSectionId;

      const getOrderedSectionPages = (pagesList: NotePage[], sectionId: string | null) => {
        if (!sectionId) return [] as NotePage[];
        const secPages = pagesList.filter((p) => p.sectionId === sectionId && !p.isDeleted);
        const idSet = new Set(secPages.map((p) => p.id));
        const topLevel = secPages.filter((p) => !p.parentId || !idSet.has(p.parentId));
        const ordered: NotePage[] = [];
        for (const pg of topLevel) {
          ordered.push(pg);
          ordered.push(...secPages.filter((sub) => sub.parentId === pg.id));
        }
        return ordered;
      };

      const orderedBefore = getOrderedSectionPages(prev.pages, targetSectionId);
      const activeIdxBefore = prev.activePageId
        ? orderedBefore.findIndex((p) => p.id === prev.activePageId)
        : -1;
      const pageIdxBefore = orderedBefore.findIndex((p) => p.id === pageId);
      const deletedIdx = activeIdxBefore >= 0 ? activeIdxBefore : pageIdxBefore;

      const deletedIds = new Set(
        prev.pages.filter((p) => p.id === pageId || p.parentId === pageId).map((p) => p.id)
      );

      const updatedPages = prev.pages.map((p) =>
        deletedIds.has(p.id) ? { ...p, isDeleted: true, deletedAt: now } : p
      );

      let nextActive = prev.activePageId;
      if (prev.activePageId && deletedIds.has(prev.activePageId)) {
        const remainingInOrder = getOrderedSectionPages(updatedPages, targetSectionId);
        if (remainingInOrder.length === 0) {
          nextActive = null;
        } else {
          const targetIdx = deletedIdx >= 0 ? Math.min(deletedIdx, remainingInOrder.length - 1) : 0;
          nextActive = remainingInOrder[targetIdx]?.id ?? remainingInOrder[0].id;
        }
      }

      return {
        ...prev,
        pages: updatedPages,
        activePageId: nextActive,
      };
    });
  }, []);

  const restorePage = useCallback((pageId: string) => {
    setState((prev) => ({
      ...prev,
      pages: prev.pages.map((p) =>
        p.id === pageId ? { ...p, isDeleted: false, deletedAt: null, parentId: null } : p
      ),
    }));
  }, []);

  const permanentlyDeletePage = useCallback((pageId: string) => {
    setState((prev) => ({
      ...prev,
      pages: prev.pages.filter((p) => p.id !== pageId && p.parentId !== pageId),
    }));
  }, []);

  const emptyTrash = useCallback(() => {
    setState((prev) => ({
      ...prev,
      pages: prev.pages.filter((p) => !p.isDeleted),
    }));
  }, []);

  const updateBlock = useCallback((pageId: string, blockId: string, patch: Partial<NoteBlock>) => {
    setState((prev) => ({
      ...prev,
      pages: prev.pages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              updatedAt: Date.now(),
              blocks: p.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)),
            }
          : p
      ),
    }));
  }, []);

  const insertBlockAfter = useCallback((pageId: string, afterBlockId: string | null, block: NoteBlock) => {
    setState((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => {
        if (p.id !== pageId) return p;
        const blocks = [...p.blocks];
        if (!afterBlockId) {
          blocks.push(block);
        } else {
          const idx = blocks.findIndex((b) => b.id === afterBlockId);
          if (idx === -1) blocks.push(block);
          else blocks.splice(idx + 1, 0, block);
        }
        return { ...p, updatedAt: Date.now(), blocks };
      }),
    }));
  }, []);

  const prependBlocks = useCallback((pageId: string, blocksToInsert: NoteBlock[]) => {
    setState((prev) => ({
      ...prev,
      pages: prev.pages.map((p) =>
        p.id === pageId
          ? { ...p, updatedAt: Date.now(), blocks: [...blocksToInsert, ...p.blocks] }
          : p
      ),
    }));
  }, []);

  const appendBlocks = useCallback((pageId: string, blocksToInsert: NoteBlock[]) => {
    setState((prev) => ({
      ...prev,
      pages: prev.pages.map((p) =>
        p.id === pageId
          ? { ...p, updatedAt: Date.now(), blocks: [...p.blocks, ...blocksToInsert] }
          : p
      ),
    }));
  }, []);

  const replaceBlocks = useCallback((pageId: string, blocks: NoteBlock[]) => {
    setState((prev) => ({
      ...prev,
      pages: prev.pages.map((p) =>
        p.id === pageId ? { ...p, updatedAt: Date.now(), blocks } : p
      ),
    }));
  }, []);

  const deleteBlock = useCallback((pageId: string, blockId: string) => {
    setState((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => {
        if (p.id !== pageId) return p;
        const filtered = p.blocks.filter((b) => b.id !== blockId);
        return {
          ...p,
          updatedAt: Date.now(),
          blocks: filtered,
        };
      }),
    }));
  }, []);

  const moveBlock = useCallback((pageId: string, blockId: string, direction: 'up' | 'down') => {
    setState((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => {
        if (p.id !== pageId) return p;
        const idx = p.blocks.findIndex((b) => b.id === blockId);
        if (idx === -1) return p;
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= p.blocks.length) return p;
        const blocks = [...p.blocks];
        const [item] = blocks.splice(idx, 1);
        blocks.splice(targetIdx, 0, item);
        return { ...p, updatedAt: Date.now(), blocks };
      }),
    }));
  }, []);

  const importWorkspace = useCallback((newState: WorkspaceState) => {
    setState({
      ...newState,
      activeView: 'shelf',
    });
  }, []);

  const setPaperStyle = useCallback((pageId: string, paperStyle: PaperStyle) => {
    updatePage(pageId, { paperStyle });
  }, [updatePage]);

  const insertPdfPages = useCallback(
    (
      sectionId: string,
      targetPageId: string | null,
      fileName: string,
      pdfPages: Array<{
        pdfId: string;
        aspectRatio: number;
        widthMm: number;
        heightMm: number;
        pageNumber: number;
        totalPages: number;
        textBoxes?: PdfTextBox[];
      }>
    ) => {
      if (pdfPages.length === 0) return;
      const now = Date.now();

      const resolveFormat = (widthMm: number, heightMm: number): PageFormat => {
        if (widthMm === 210 && heightMm === 297) return { preset: 'A4', widthMm, heightMm };
        if (widthMm === 148 && heightMm === 210) return { preset: 'A5', widthMm, heightMm };
        if (widthMm === 216 && heightMm === 279) return { preset: 'Letter', widthMm, heightMm };
        if (widthMm === 216 && heightMm === 356) return { preset: 'Legal', widthMm, heightMm };
        if (widthMm === 297 && heightMm === 210) return { preset: 'A4 Paisagem', widthMm, heightMm };
        return { preset: 'Custom', widthMm, heightMm };
      };

      setState((prev) => {
        const targetIdx = targetPageId ? prev.pages.findIndex((p) => p.id === targetPageId) : -1;
        const targetPage = targetIdx >= 0 ? prev.pages[targetIdx] : null;
        const isTargetBlank =
          !!targetPage &&
          !targetPage.isDeleted &&
          !targetPage.pdfBackground &&
          targetPage.title.trim() === '' &&
          (targetPage.inkStrokes?.length ?? 0) === 0 &&
          targetPage.blocks.every((b) => b.type === 'paragraph' && b.content.trim() === '');

        const inheritedColor: PageBackgroundColor = targetPage?.pageColor ?? 'auto';
        const nextPages = [...prev.pages];
        let firstInsertedId: string | null = null;

        if (isTargetBlank && targetPage) {
          const first = pdfPages[0];
          nextPages[targetIdx] = {
            ...targetPage,
            hideTitle: true,
            paperStyle: 'plain',
            pageFormat: resolveFormat(first.widthMm, first.heightMm),
            pageColor: inheritedColor,
            pdfBackground: {
              pdfId: first.pdfId,
              aspectRatio: first.aspectRatio,
              fileName,
              pageNumber: first.pageNumber,
              totalPages: first.totalPages,
              textBoxes: first.textBoxes,
            },
            blocks: [],
            updatedAt: now,
          };
          firstInsertedId = targetPage.id;

          const extraPages: NotePage[] = pdfPages.slice(1).map((pgData, idx) => ({
            id: uid('pg'),
            sectionId,
            parentId: null,
            title: '',
            hideTitle: true,
            paperStyle: 'plain',
            pageFormat: resolveFormat(pgData.widthMm, pgData.heightMm),
            pageColor: inheritedColor,
            pdfBackground: {
              pdfId: pgData.pdfId,
              aspectRatio: pgData.aspectRatio,
              fileName,
              pageNumber: pgData.pageNumber,
              totalPages: pgData.totalPages,
              textBoxes: pgData.textBoxes,
            },
            isFavorite: false,
            isDeleted: false,
            deletedAt: null,
            blocks: [],
            createdAt: now + idx + 1,
            updatedAt: now + idx + 1,
          }));
          nextPages.splice(targetIdx + 1, 0, ...extraPages);
        } else {
          const created: NotePage[] = pdfPages.map((pgData, idx) => ({
            id: uid('pg'),
            sectionId,
            parentId: null,
            title: '',
            hideTitle: true,
            paperStyle: 'plain',
            pageFormat: resolveFormat(pgData.widthMm, pgData.heightMm),
            pageColor: inheritedColor,
            pdfBackground: {
              pdfId: pgData.pdfId,
              aspectRatio: pgData.aspectRatio,
              fileName,
              pageNumber: pgData.pageNumber,
              totalPages: pgData.totalPages,
              textBoxes: pgData.textBoxes,
            },
            isFavorite: false,
            isDeleted: false,
            deletedAt: null,
            blocks: [],
            createdAt: now + idx,
            updatedAt: now + idx,
          }));
          firstInsertedId = created[0].id;
          if (targetIdx >= 0) {
            nextPages.splice(targetIdx + 1, 0, ...created);
          } else {
            nextPages.push(...created);
          }
        }

        return {
          ...prev,
          pages: nextPages,
          activeSectionId: sectionId,
          activePageId: firstInsertedId,
          activeView: 'editor',
        };
      });
    },
    []
  );

  const value: NotesContextValue = {
    state,
    isLoaded,
    lastSavedAt,
    activeNotebook,
    activeSection,
    activePage,
    shelfFolderId,
    setShelfFolderId,
    shelfNotebookId,
    setShelfNotebookId,
    openFolderView,
    toggleTheme,
    setActiveView,
    openNotebook,
    openNotebookSections,
    selectSection,
    selectPage,
    createNotebook,
    updateNotebook,
    deleteNotebook,
    createFolder,
    updateFolder,
    deleteFolder,
    moveNotebookToFolder,
    createSection,
    updateSection,
    deleteSection,
    createPage,
    insertPdfPages,
    updatePage,
    setSectionPageColor,
    setScrollDirection,
    softDeletePage,
    restorePage,
    permanentlyDeletePage,
    emptyTrash,
    updateBlock,
    insertBlockAfter,
    prependBlocks,
    appendBlocks,
    replaceBlocks,
    deleteBlock,
    moveBlock,
    importWorkspace,
    setPaperStyle,
  };

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
};

export function useNotesStore(): NotesContextValue {
  const ctx = useContext(NotesContext);
  if (!ctx) {
    throw new Error('useNotesStore deve ser usado dentro de NotesProvider.');
  }
  return ctx;
}
