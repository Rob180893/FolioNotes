import React, { useEffect, useMemo, useState } from 'react';
import {
  BookMarked,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  FileText,
  Folder,
  FolderKanban,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useNotesStore } from '../../store/useNotesStore';

const SECTION_COLORS = ['#4F46E5', '#059669', '#D97706', '#E11D48', '#0284C7', '#7C3AED'];

interface HierarchySidebarProps {
  onCloseMobile?: () => void;
}

export const HierarchySidebar: React.FC<HierarchySidebarProps> = ({ onCloseMobile }) => {
  const {
    state,
    activeNotebook,
    activeSection,
    activePage,
    setActiveView,
    openNotebookSections,
    selectSection,
    selectPage,
    createSection,
    updateSection,
    deleteSection,
    createPage,
    shelfFolderId,
    openFolderView,
  } = useNotesStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>(
    () => shelfFolderId || activeNotebook?.folderId || '__all__'
  );
  const [showNewSectionForm, setShowNewSectionForm] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionColor, setNewSectionColor] = useState(SECTION_COLORS[0]);
  const [collapsedParents, setCollapsedParents] = useState<Record<string, boolean>>({});
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState('');

  useEffect(() => {
    if (state.activeView === 'shelf') {
      setSelectedFolderFilter(shelfFolderId || '__all__');
    } else if (state.activeView === 'editor' && activeNotebook) {
      setSelectedFolderFilter(activeNotebook.folderId || '__none__');
    }
  }, [state.activeView, shelfFolderId, activeNotebook?.id, activeNotebook?.folderId]);

  const filteredNotebooks = useMemo(() => {
    if (selectedFolderFilter === '__all__') return state.notebooks;
    if (selectedFolderFilter === '__none__') return state.notebooks.filter((nb) => !nb.folderId);
    return state.notebooks.filter((nb) => nb.folderId === selectedFolderFilter);
  }, [state.notebooks, selectedFolderFilter]);

  const openSelectedFolderOnRight = (filterValue: string) => {
    if (filterValue === '__all__' || filterValue === '__none__') {
      openFolderView(null);
    } else {
      openFolderView(filterValue);
    }
    onCloseMobile?.();
  };

  const handleFolderFilterChange = (nextFilter: string) => {
    setSelectedFolderFilter(nextFilter);
    openSelectedFolderOnRight(nextFilter);
  };

  const notebookSections = useMemo(() => {
    if (!activeNotebook) return [];
    return state.sections
      .filter((s) => s.notebookId === activeNotebook.id)
      .sort((a, b) => a.order - b.order);
  }, [state.sections, activeNotebook]);

  const sectionPages = useMemo(() => {
    if (!activeSection) return [];
    return state.pages.filter(
      (p) => p.sectionId === activeSection.id && !p.isDeleted && !p.hideTitle && p.title.trim().length > 0
    );
  }, [state.pages, activeSection]);

  const topLevelPages = useMemo(() => {
    const idSet = new Set(sectionPages.map((p) => p.id));
    return sectionPages.filter((p) => !p.parentId || !idSet.has(p.parentId));
  }, [sectionPages]);

  const globalSearchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return state.pages
      .filter((p) => !p.isDeleted)
      .filter((p) => {
        if (p.title.toLowerCase().includes(q)) return true;
        return p.blocks.some((b) => b.content.toLowerCase().includes(q));
      })
      .slice(0, 12);
  }, [state.pages, searchQuery]);

  const favoritesCount = useMemo(
    () => state.pages.filter((p) => !p.isDeleted && p.isFavorite).length,
    [state.pages]
  );
  const trashCount = useMemo(
    () => state.pages.filter((p) => p.isDeleted).length,
    [state.pages]
  );

  const handleCreateSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeNotebook || !newSectionName.trim()) return;
    createSection(activeNotebook.id, newSectionName, newSectionColor);
    setNewSectionName('');
    setShowNewSectionForm(false);
  };

  const handlePageSelect = (pageId: string) => {
    selectPage(pageId);
    onCloseMobile?.();
  };

  return (
    <aside className="no-print flex h-full w-72 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 select-none">
      {/* Global Search & Top Quick Destinations */}
      <div className="p-3 space-y-2.5 border-b border-slate-200 dark:border-slate-800">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Busca global nas notas..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 pl-8 pr-8 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-1">
          <button
            type="button"
            onClick={() => {
              openFolderView(null);
              onCloseMobile?.();
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 text-xs font-medium transition-colors cursor-pointer ${
              state.activeView === 'shelf'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FolderKanban className="w-3.5 h-3.5" />
            <span>Estante</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveView('favorites');
              onCloseMobile?.();
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 text-xs font-medium transition-colors cursor-pointer ${
              state.activeView === 'favorites'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            <span className="tabular-nums">Fav ({favoritesCount})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveView('trash');
              onCloseMobile?.();
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 text-xs font-medium transition-colors cursor-pointer ${
              state.activeView === 'trash'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="tabular-nums">Lixo ({trashCount})</span>
          </button>
        </div>
      </div>

      {/* Global Search Results View */}
      {searchQuery.trim() ? (
        <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-1.5">
          <div className="px-1 text-[11px] font-medium text-slate-400">
            {globalSearchResults.length} resultado(s)
          </div>
          {globalSearchResults.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-slate-400">
              Nenhuma nota encontrada para “{searchQuery}”.
            </p>
          ) : (
            globalSearchResults.map((pg) => {
              const sec = state.sections.find((s) => s.id === pg.sectionId);
              const nb = sec ? state.notebooks.find((n) => n.id === sec.notebookId) : null;
              return (
                <button
                  key={pg.id}
                  type="button"
                  onClick={() => handlePageSelect(pg.id)}
                  className="w-full rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 p-2.5 text-left hover:border-indigo-300 dark:hover:border-indigo-700 cursor-pointer"
                >
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {pg.title || 'Sem título'}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400 truncate">
                    {nb?.title} · {sec?.name}
                  </div>
                </button>
              );
            })
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Level 1: Active Folder & Notebook Selectors */}
          <div className="px-3 pt-3 pb-2.5 border-b border-slate-100 dark:border-slate-800/80 space-y-2.5">
            <div>
              <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 mb-1">
                <span>Pasta ativa</span>
                <button
                  type="button"
                  onClick={() => openSelectedFolderOnRight(selectedFolderFilter)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  title="Visualizar cadernos desta pasta ao lado"
                >
                  <span>Ver cadernos</span>
                </button>
              </div>
              <div className="relative">
                <Folder className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={selectedFolderFilter}
                  onChange={(e) => handleFolderFilterChange(e.target.value)}
                  aria-label="Selecionar pasta ativa"
                  className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-8 pr-7 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="__all__">Todas as pastas</option>
                  <option value="__none__">Sem pasta (Início)</option>
                  {state.folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 mb-1">
                <span>Caderno ativo</span>
                {activeNotebook && (
                  <button
                    type="button"
                    onClick={() => {
                      openNotebookSections(activeNotebook.id);
                      onCloseMobile?.();
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    title="Visualizar seções deste caderno ao lado"
                  >
                    <span>Ver seções</span>
                  </button>
                )}
              </div>
              <div className="relative">
                <BookMarked className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={filteredNotebooks.some((n) => n.id === activeNotebook?.id) ? activeNotebook?.id || '' : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      openNotebookSections(e.target.value);
                      onCloseMobile?.();
                    }
                  }}
                  disabled={filteredNotebooks.length === 0}
                  aria-label="Selecionar caderno ativo"
                  className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-8 pr-7 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer disabled:opacity-60"
                >
                  {filteredNotebooks.length === 0 ? (
                    <option value="">Nenhum caderno nesta pasta</option>
                  ) : (
                    filteredNotebooks.map((nb) => {
                      const folder = nb.folderId ? state.folders.find((f) => f.id === nb.folderId) : null;
                      return (
                        <option key={nb.id} value={nb.id}>
                          {selectedFolderFilter === '__all__' && folder ? `${folder.name} / ${nb.title}` : nb.title}
                        </option>
                      );
                    })
                  )}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Level 2: Colored Section Tabs (OneNote style) */}
          <div className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-slate-400">Seções</span>
              <button
                type="button"
                onClick={() => setShowNewSectionForm((v) => !v)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Nova</span>
              </button>
            </div>

            {showNewSectionForm && (
              <form onSubmit={handleCreateSection} className="mb-2.5 space-y-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-2.5">
                <input
                  type="text"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  placeholder="Nome da seção..."
                  autoFocus
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {SECTION_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewSectionColor(c)}
                        className={`h-4 w-4 rounded-full cursor-pointer ${
                          newSectionColor === c ? 'ring-2 ring-offset-1 ring-slate-900 dark:ring-white' : ''
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <button
                    type="submit"
                    className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-700 cursor-pointer"
                  >
                    Criar
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
              {notebookSections.map((sec) => {
                const isSelected = activeSection?.id === sec.id && state.activeView === 'editor';
                const count = state.pages.filter((p) => p.sectionId === sec.id && !p.isDeleted).length;

                if (editingSectionId === sec.id) {
                  return (
                    <form
                      key={sec.id}
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (editingSectionName.trim()) {
                          updateSection(sec.id, { name: editingSectionName.trim() });
                        }
                        setEditingSectionId(null);
                      }}
                      className="flex items-center gap-1"
                    >
                      <input
                        type="text"
                        value={editingSectionName}
                        onChange={(e) => setEditingSectionName(e.target.value)}
                        onBlur={() => setEditingSectionId(null)}
                        autoFocus
                        className="w-full rounded-lg border border-indigo-400 bg-white dark:bg-slate-900 px-2 py-1 text-xs focus:outline-none"
                      />
                    </form>
                  );
                }

                return (
                  <div
                    key={sec.id}
                    onClick={() => {
                      selectSection(sec.id);
                      onCloseMobile?.();
                    }}
                    onDoubleClick={() => {
                      setEditingSectionId(sec.id);
                      setEditingSectionName(sec.name);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') selectSection(sec.id);
                    }}
                    className={`group flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      isSelected
                        ? 'text-white shadow-xs'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    style={isSelected ? { backgroundColor: sec.color } : undefined}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: isSelected ? '#ffffff' : sec.color }}
                      />
                      <span className="truncate">{sec.name}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={`text-[11px] tabular-nums ${
                          isSelected ? 'text-white/80' : 'text-slate-400'
                        }`}
                      >
                        {count}
                      </span>
                      {notebookSections.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSection(sec.id);
                          }}
                          className={`opacity-0 group-hover:opacity-100 p-0.5 rounded cursor-pointer ${
                            isSelected ? 'hover:bg-white/20 text-white' : 'hover:text-rose-500 text-slate-400'
                          }`}
                          title="Excluir seção"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Level 3: Pages & Indented Subpages */}
          <div className="flex-1 flex flex-col overflow-hidden p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-slate-400">Páginas</span>
              {activeSection && (
                <button
                  type="button"
                  onClick={() => {
                    createPage(activeSection.id, null, '');
                    onCloseMobile?.();
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Página</span>
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin space-y-0.5">
              {topLevelPages.length === 0 ? (
                <p className="py-6 px-2 text-center text-xs text-slate-400">
                  Nenhuma página com título nesta seção.
                </p>
              ) : (
                topLevelPages.map((pg) => {
                  const subpages = sectionPages.filter((sub) => sub.parentId === pg.id);
                  const hasChildren = subpages.length > 0;
                  const isCollapsed = !!collapsedParents[pg.id];
                  const isActive = activePage?.id === pg.id && state.activeView === 'editor';

                  return (
                    <div key={pg.id}>
                      <div
                        onClick={() => handlePageSelect(pg.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handlePageSelect(pg.id);
                        }}
                        className={`group flex items-center justify-between gap-1.5 rounded-lg px-2 py-1.5 text-xs transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-200 font-semibold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          {hasChildren ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCollapsedParents((prev) => ({ ...prev, [pg.id]: !prev[pg.id] }));
                              }}
                              className="p-0.5 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700/70 shrink-0 cursor-pointer"
                              aria-label="Expandir ou recolher subpáginas"
                            >
                              {isCollapsed ? (
                                <ChevronRight className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
                          ) : (
                            <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-0.5" />
                          )}
                          <span className="truncate">{pg.title || 'Sem título'}</span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {pg.isFavorite && (
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          )}
                          {activeSection && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                createPage(activeSection.id, pg.id, '');
                                setCollapsedParents((prev) => ({ ...prev, [pg.id]: false }));
                                onCloseMobile?.();
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                              title="Adicionar subpágina recuada"
                            >
                              <CornerDownRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Indented Subpages */}
                      {hasChildren && !isCollapsed && (
                        <div className="ml-4 pl-2 border-l border-slate-200 dark:border-slate-800 space-y-0.5 my-0.5">
                          {subpages.map((sub) => {
                            const isSubActive = activePage?.id === sub.id && state.activeView === 'editor';
                            return (
                              <div
                                key={sub.id}
                                onClick={() => handlePageSelect(sub.id)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handlePageSelect(sub.id);
                                }}
                                className={`flex items-center justify-between gap-1.5 rounded-lg px-2 py-1.5 text-xs transition-colors cursor-pointer ${
                                  isSubActive
                                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-200 font-semibold'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <CornerDownRight className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{sub.title || 'Sem título'}</span>
                                </div>
                                {sub.isFavorite && (
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
