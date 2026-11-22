import React, { useRef, useState } from 'react';
import {
  ChevronLeft,
  Clock,
  Edit3,
  FileText,
  FileUp,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Layers,
  Plus,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import type { CoverPattern, Notebook, NotebookFolder, NotebookSection } from '../../types/notes';
import { useNotesStore } from '../../store/useNotesStore';
import { NotebookCoverVisual } from './NotebookCoverVisual';
import { exportWorkspaceBackupJson, parseWorkspaceBackupJson } from '../../services/export/exportService';

const COVER_COLORS = [
  '#312E81',
  '#1E40AF',
  '#0F766E',
  '#059669',
  '#B45309',
  '#BE123C',
  '#6D28D9',
  '#334155',
];

const FOLDER_COLORS = [
  '#4F46E5',
  '#0284C7',
  '#059669',
  '#D97706',
  '#E11D48',
  '#7C3AED',
  '#475569',
];

const COVER_PATTERNS: Array<{ id: CoverPattern; label: string }> = [
  { id: 'linen', label: 'Linho' },
  { id: 'solid', label: 'Fosco' },
  { id: 'stripes', label: 'Listrado' },
  { id: 'minimal', label: 'Suave' },
];

export const NotebookShelf: React.FC = () => {
  const {
    state,
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
    importWorkspace,
    shelfFolderId: activeFolderId,
    setShelfFolderId: setActiveFolderId,
    shelfNotebookId,
    setShelfNotebookId,
  } = useNotesStore();

  // Notebook Modal State
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverColor, setCoverColor] = useState(COVER_COLORS[0]);
  const [coverPattern, setCoverPattern] = useState<CoverPattern>('linen');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');

  // Folder Modal State
  const [folderModalMode, setFolderModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [folderName, setFolderName] = useState('');
  const [folderColor, setFolderColor] = useState(FOLDER_COLORS[0]);

  // Section Modal State
  const [sectionModalMode, setSectionModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionName, setSectionName] = useState('');
  const [sectionColor, setSectionColor] = useState(FOLDER_COLORS[0]);

  // Quick Move Notebook Popover
  const [movingNotebookId, setMovingNotebookId] = useState<string | null>(null);

  const [backupFeedback, setBackupFeedback] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const activeShelfNotebook = shelfNotebookId
    ? state.notebooks.find((n) => n.id === shelfNotebookId) ?? null
    : null;

  const activeShelfNotebookFolder =
    activeShelfNotebook?.folderId
      ? state.folders.find((f) => f.id === activeShelfNotebook.folderId) ?? null
      : null;

  const activeNotebookSections = activeShelfNotebook
    ? state.sections
        .filter((s) => s.notebookId === activeShelfNotebook.id)
        .sort((a, b) => a.order - b.order)
    : [];

  const activeFolder = activeFolderId
    ? state.folders.find((f) => f.id === activeFolderId) ?? null
    : null;

  const visibleNotebooks = state.notebooks.filter((nb) =>
    activeFolder ? nb.folderId === activeFolder.id : !nb.folderId
  );

  const openCreateModal = () => {
    setModalMode('create');
    setEditingId(null);
    setTitle('');
    setDescription('');
    setCoverColor(COVER_COLORS[0]);
    setCoverPattern('linen');
    setSelectedFolderId(activeFolder?.id || '');
  };

  const openEditModal = (nb: Notebook, e: React.MouseEvent) => {
    e.stopPropagation();
    setModalMode('edit');
    setEditingId(nb.id);
    setTitle(nb.title);
    setDescription(nb.description);
    setCoverColor(nb.coverColor);
    setCoverPattern(nb.coverPattern);
    setSelectedFolderId(nb.folderId || '');
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    const folderId = selectedFolderId || null;
    if (modalMode === 'create') {
      createNotebook({ title, description, coverColor, coverPattern, folderId });
    } else if (modalMode === 'edit' && editingId) {
      updateNotebook(editingId, {
        title: title.trim() || 'Caderno sem título',
        description: description.trim(),
        coverColor,
        coverPattern,
        folderId,
      });
    }
    setModalMode(null);
  };

  const openCreateFolderModal = () => {
    setFolderModalMode('create');
    setEditingFolderId(null);
    setFolderName('');
    setFolderColor(FOLDER_COLORS[0]);
  };

  const openEditFolderModal = (folder: NotebookFolder, e: React.MouseEvent) => {
    e.stopPropagation();
    setFolderModalMode('edit');
    setEditingFolderId(folder.id);
    setFolderName(folder.name);
    setFolderColor(folder.color);
  };

  const handleSaveFolderModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    if (folderModalMode === 'create') {
      createFolder(folderName, folderColor);
    } else if (folderModalMode === 'edit' && editingFolderId) {
      updateFolder(editingFolderId, {
        name: folderName.trim(),
        color: folderColor,
      });
    }
    setFolderModalMode(null);
  };

  const handleDeleteFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteFolder(folderId);
    if (activeFolderId === folderId) {
      setActiveFolderId(null);
    }
  };

  const openCreateSectionModal = () => {
    setSectionModalMode('create');
    setEditingSectionId(null);
    setSectionName('');
    setSectionColor(FOLDER_COLORS[0]);
  };

  const openEditSectionModal = (section: NotebookSection, e: React.MouseEvent) => {
    e.stopPropagation();
    setSectionModalMode('edit');
    setEditingSectionId(section.id);
    setSectionName(section.name);
    setSectionColor(section.color);
  };

  const handleSaveSectionModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionName.trim() || !activeShelfNotebook) return;
    if (sectionModalMode === 'create') {
      createSection(activeShelfNotebook.id, sectionName.trim(), sectionColor);
    } else if (sectionModalMode === 'edit' && editingSectionId) {
      updateSection(editingSectionId, {
        name: sectionName.trim(),
        color: sectionColor,
      });
    }
    setSectionModalMode(null);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseWorkspaceBackupJson(String(reader.result || ''));
        importWorkspace(parsed);
        setBackupFeedback('Backup restaurado com sucesso!');
      } catch (err) {
        setBackupFeedback(err instanceof Error ? err.message : 'Erro ao importar arquivo.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const recentPages = [...state.pages]
    .filter((p) => !p.isDeleted)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 6);

  return (
    <div
      className="flex-1 overflow-y-auto scrollbar-thin bg-slate-50 dark:bg-slate-950 p-5 sm:p-8 lg:p-10"
      onClick={() => movingNotebookId && setMovingNotebookId(null)}
    >
      <div className="mx-auto max-w-6xl space-y-9">
        {/* Shelf Header */}
        {activeShelfNotebook ? (
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                <button
                  type="button"
                  onClick={() => {
                    setShelfNotebookId(null);
                    setActiveFolderId(null);
                  }}
                  className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Estante de Cadernos</span>
                </button>
                {activeShelfNotebookFolder && (
                  <>
                    <span>/</span>
                    <button
                      type="button"
                      onClick={() => {
                        setShelfNotebookId(null);
                        setActiveFolderId(activeShelfNotebookFolder.id);
                      }}
                      className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      <Folder className="w-3 h-3" style={{ color: activeShelfNotebookFolder.color }} />
                      <span>{activeShelfNotebookFolder.name}</span>
                    </button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3.5 min-w-0">
                <span
                  className="h-9 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: activeShelfNotebook.coverColor }}
                />
                <div className="min-w-0">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 truncate">
                    {activeShelfNotebook.title}
                  </h1>
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                    {activeShelfNotebook.description ? `${activeShelfNotebook.description} · ` : ''}
                    {activeNotebookSections.length}{' '}
                    {activeNotebookSections.length === 1 ? 'seção' : 'seções'} · Escolha uma seção para abrir
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={(e) => openEditModal(activeShelfNotebook, e)}
                className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Personalizar Capa</span>
              </button>
              <button
                type="button"
                onClick={openCreateSectionModal}
                className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Seção</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
            <div>
              {activeFolder ? (
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveFolderId(null)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Estante de Cadernos</span>
                  </button>
                  <div className="flex items-center gap-2.5">
                    <Folder className="w-6 h-6 shrink-0" style={{ color: activeFolder.color }} />
                    <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                      {activeFolder.name}
                    </h1>
                  </div>
                </div>
              ) : (
                <div>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                    Estante de Cadernos
                  </h1>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {state.folders.length} {state.folders.length === 1 ? 'pasta' : 'pastas'} ·{' '}
                    {state.notebooks.length} {state.notebooks.length === 1 ? 'caderno' : 'cadernos'} ·{' '}
                    {state.pages.filter((p) => !p.isDeleted).length} páginas ativas
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                onChange={handleImportJson}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <FileUp className="w-3.5 h-3.5" />
                <span>Restaurar Backup</span>
              </button>
              <button
                type="button"
                onClick={() => exportWorkspaceBackupJson(state)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Exportar Tudo (.json)</span>
              </button>
              {!activeFolder && (
                <button
                  type="button"
                  onClick={openCreateFolderModal}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 px-3.5 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>Nova Pasta</span>
                </button>
              )}
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Caderno</span>
              </button>
            </div>
          </div>
        )}

        {backupFeedback && (
          <div className="flex items-center justify-between rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 px-4 py-2.5 text-xs font-medium text-indigo-800 dark:text-indigo-200">
            <span>{backupFeedback}</span>
            <button type="button" onClick={() => setBackupFeedback(null)} className="cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {activeShelfNotebook ? (
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
              <Layers className="w-4 h-4 text-slate-400" />
              <h2>Seções do caderno</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeNotebookSections.map((sec) => {
                const secPages = state.pages.filter((p) => p.sectionId === sec.id && !p.isDeleted);
                const titledPages = secPages.filter((p) => !p.hideTitle && p.title.trim().length > 0).slice(0, 3);

                return (
                  <div
                    key={sec.id}
                    onClick={() => selectSection(sec.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') selectSection(sec.id);
                    }}
                    className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-left hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors cursor-pointer"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="h-3.5 w-3.5 rounded-sm shrink-0"
                            style={{ backgroundColor: sec.color }}
                          />
                          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {sec.name}
                          </h3>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            type="button"
                            onClick={(e) => openEditSectionModal(sec, e)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="Renomear seção"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {activeNotebookSections.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSection(sec.id);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                              title="Excluir seção"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {secPages.length} {secPages.length === 1 ? 'página' : 'páginas'}
                      </div>

                      {titledPages.length > 0 ? (
                        <div className="space-y-1.5 pt-1">
                          {titledPages.map((pg) => (
                            <div
                              key={pg.id}
                              className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 truncate"
                            >
                              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{pg.title}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="pt-1 text-xs text-slate-400 dark:text-slate-500">
                          Clique para abrir as folhas desta seção
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      <span>Abrir seção</span>
                      <span aria-hidden="true">→</span>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={openCreateSectionModal}
                className="min-h-[156px] flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
              >
                <Plus className="w-5 h-5" />
                <span className="text-xs font-medium">Nova Seção</span>
              </button>
            </div>
          </section>
        ) : (
          <>

        {/* Folders Section (visible at root shelf) */}
        {!activeFolder && (
          <section className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                <Folder className="w-4 h-4 text-slate-400" />
                <h2>Pastas</h2>
              </div>
              <button
                type="button"
                onClick={openCreateFolderModal}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Criar pasta</span>
              </button>
            </div>

            {state.folders.length === 0 ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 px-5 py-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Organize seus cadernos por matéria, projeto ou área criando pastas temáticas.
                </p>
                <button
                  type="button"
                  onClick={openCreateFolderModal}
                  className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Criar Primeira Pasta</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {state.folders.map((folder) => {
                  const nbCount = state.notebooks.filter((nb) => nb.folderId === folder.id).length;
                  return (
                    <div
                      key={folder.id}
                      onClick={() => setActiveFolderId(folder.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setActiveFolderId(folder.id);
                      }}
                      className="group relative flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-left hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                          style={{ backgroundColor: `${folder.color}18`, color: folder.color }}
                        >
                          <Folder className="w-5 h-5 fill-current/20" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {folder.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            {nbCount} {nbCount === 1 ? 'caderno' : 'cadernos'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          type="button"
                          onClick={(e) => openEditFolderModal(folder, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="Renomear pasta"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteFolder(folder.id, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          title="Excluir pasta (mantém cadernos)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Notebooks Grid */}
        <section className="space-y-4">
          {!activeFolder && state.folders.length > 0 && (
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Cadernos Soltos
            </h2>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {visibleNotebooks.map((nb) => {
              const nbSections = state.sections.filter((s) => s.notebookId === nb.id);
              const secIds = new Set(nbSections.map((s) => s.id));
              const pageCount = state.pages.filter((p) => secIds.has(p.sectionId) && !p.isDeleted).length;

              return (
                <div
                  key={nb.id}
                  onClick={() => openNotebookSections(nb.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') openNotebookSections(nb.id);
                  }}
                  className="group relative flex flex-col text-left cursor-pointer focus-visible:outline-none"
                >
                  <div className="relative">
                    <NotebookCoverVisual
                      title={nb.title}
                      color={nb.coverColor}
                      pattern={nb.coverPattern}
                    />

                    {/* Hover Actions */}
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateNotebook(nb.id, { isFavorite: !nb.isFavorite });
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 shadow-xs hover:text-amber-500 cursor-pointer"
                        title="Favoritar caderno"
                      >
                        <Star className={`w-3.5 h-3.5 ${nb.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>

                      {state.folders.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMovingNotebookId((prev) => (prev === nb.id ? null : nb.id));
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 shadow-xs hover:text-indigo-600 cursor-pointer"
                          title="Mover para pasta"
                        >
                          <FolderInput className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => openEditModal(nb, e)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 shadow-xs hover:text-indigo-600 cursor-pointer"
                        title="Personalizar capa"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {state.notebooks.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotebook(nb.id);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 shadow-xs hover:text-rose-600 cursor-pointer"
                          title="Excluir caderno"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Quick Move to Folder Popover */}
                    {movingNotebookId === nb.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-2 top-11 z-30 w-48 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 shadow-xl"
                      >
                        <div className="px-2 py-1 text-[11px] font-medium text-slate-400">
                          Mover para pasta
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            moveNotebookToFolder(nb.id, null);
                            setMovingNotebookId(null);
                          }}
                          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-left hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer ${
                            !nb.folderId ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <span className="truncate">Sem pasta (Início)</span>
                        </button>
                        {state.folders.map((folder) => (
                          <button
                            key={folder.id}
                            type="button"
                            onClick={() => {
                              moveNotebookToFolder(nb.id, folder.id);
                              setMovingNotebookId(null);
                            }}
                            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-left hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer ${
                              nb.folderId === folder.id
                                ? 'font-semibold text-indigo-600 dark:text-indigo-400'
                                : 'text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            <Folder className="w-3.5 h-3.5 shrink-0" style={{ color: folder.color }} />
                            <span className="truncate">{folder.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-2.5 px-0.5">
                    <div className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {nb.title}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {nbSections.length} {nbSections.length === 1 ? 'seção' : 'seções'} · {pageCount}{' '}
                      {pageCount === 1 ? 'página' : 'páginas'}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add Notebook Placeholder Card */}
            <button
              type="button"
              onClick={openCreateModal}
              className="aspect-[3/4] flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
            >
              <Plus className="w-6 h-6" />
              <span className="text-xs font-medium text-center px-3">
                {activeFolder ? `Novo em ${activeFolder.name}` : 'Criar Caderno'}
              </span>
            </button>
          </div>
        </section>

        {/* Recent Notes Quick Access */}
        {!activeFolder && recentPages.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
              <Clock className="w-4 h-4 text-slate-400" />
              <h2>Notas Recentes</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentPages.map((pg) => {
                const sec = state.sections.find((s) => s.id === pg.sectionId);
                const nb = sec ? state.notebooks.find((n) => n.id === sec.notebookId) : null;
                const snippet = pg.blocks.find((b) => b.content.trim())?.content || 'Página em branco';

                return (
                  <button
                    key={pg.id}
                    type="button"
                    onClick={() => selectPage(pg.id)}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-left hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {pg.title || 'Sem título'}
                        </span>
                        {pg.isFavorite && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />}
                      </div>
                      <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {snippet}
                      </p>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                      <span className="truncate">{nb?.title}</span>
                      {sec && (
                        <>
                          <span>·</span>
                          <span className="truncate font-medium" style={{ color: sec.color }}>
                            {sec.name}
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}
          </>
        )}
      </div>

      {/* Create / Edit Notebook Modal (without icon picker, with folder selector) */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSaveModal}
            className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
                {modalMode === 'create' ? 'Novo Caderno' : 'Personalizar Caderno'}
              </h3>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
              <div className="w-40 shrink-0">
                <NotebookCoverVisual
                  title={title || 'Meu Caderno'}
                  color={coverColor}
                  pattern={coverPattern}
                />
              </div>

              <div className="flex-1 w-full space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Nome do caderno
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Língua Portuguesa, Projetos..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Descrição (opcional)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Breve resumo do conteúdo"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {state.folders.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Pasta
                    </label>
                    <select
                      value={selectedFolderId}
                      onChange={(e) => setSelectedFolderId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="">Sem pasta (Página inicial)</option>
                      {state.folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                    Cor da capa
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COVER_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCoverColor(c)}
                        className={`h-6 w-6 rounded-full transition-transform cursor-pointer ${
                          coverColor === c
                            ? 'scale-110 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900'
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: c }}
                        aria-label={`Cor ${c}`}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                    Textura
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {COVER_PATTERNS.map((pat) => (
                      <button
                        key={pat.id}
                        type="button"
                        onClick={() => setCoverPattern(pat.id)}
                        className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                          coverPattern === pat.id
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-200'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {pat.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="rounded-xl px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                {modalMode === 'create' ? 'Criar Caderno' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create / Edit Folder Modal */}
      {folderModalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSaveFolderModal}
            className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                {folderModalMode === 'create' ? 'Nova Pasta' : 'Editar Pasta'}
              </h3>
              <button
                type="button"
                onClick={() => setFolderModalMode(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Nome da pasta
              </label>
              <input
                type="text"
                required
                autoFocus
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Ex: Faculdade, Trabalho, Pessoal..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Cor da pasta
              </label>
              <div className="flex flex-wrap gap-2">
                {FOLDER_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFolderColor(c)}
                    className={`h-6 w-6 rounded-full transition-transform cursor-pointer ${
                      folderColor === c
                        ? 'scale-110 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Cor da pasta ${c}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setFolderModalMode(null)}
                className="rounded-xl px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                {folderModalMode === 'create' ? 'Criar Pasta' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create / Edit Section Modal */}
      {sectionModalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSaveSectionModal}
            className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                {sectionModalMode === 'create' ? 'Nova Seção' : 'Editar Seção'}
              </h3>
              <button
                type="button"
                onClick={() => setSectionModalMode(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Nome da seção
              </label>
              <input
                type="text"
                required
                autoFocus
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                placeholder="Ex: Módulo 1, Resumos, Exercícios..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Cor da seção
              </label>
              <div className="flex flex-wrap gap-2">
                {FOLDER_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSectionColor(c)}
                    className={`h-6 w-6 rounded-full transition-transform cursor-pointer ${
                      sectionColor === c
                        ? 'scale-110 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Cor da seção ${c}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSectionModalMode(null)}
                className="rounded-xl px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                {sectionModalMode === 'create' ? 'Criar Seção' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
