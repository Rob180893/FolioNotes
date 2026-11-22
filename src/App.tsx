import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  FolderKanban,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Sun,
  X,
} from 'lucide-react';
import { NotesProvider, useNotesStore } from './store/useNotesStore';
import { HierarchySidebar } from './components/navigation/HierarchySidebar';
import { NotebookShelf } from './components/shelf/NotebookShelf';
import { NoteEditor } from './components/editor/NoteEditor';
import { FavoritesAndTrashView } from './components/views/FavoritesAndTrashView';
import { OfflineIndicator, PWAInstallButton } from './components/pwa/PWAStatus';

const WorkspaceShell: React.FC = () => {
  const {
    state,
    activeNotebook,
    activeSection,
    activePage,
    toggleTheme,
    setActiveView,
    createPage,
  } = useNotesStore();

  const [sidebarOpenDesktop, setSidebarOpenDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1280 : false
  );
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState(false);

  // On tablet/compact screens (< 1280px), automatically collapse sidebar when opening a page
  useEffect(() => {
    if (state.activeView === 'editor' && activePage?.id && window.innerWidth < 1280) {
      setSidebarOpenDesktop(false);
      setSidebarOpenMobile(false);
    }
  }, [state.activeView, activePage?.id]);

  // Configure native Capacitor StatusBar so Android tablet status bar never overlaps the top header
  useEffect(() => {
    const cap = (window as unknown as {
      Capacitor?: {
        isNativePlatform?: () => boolean;
        Plugins?: {
          StatusBar?: {
            setOverlaysWebView?: (opts: { overlay: boolean }) => Promise<void>;
            setStyle?: (opts: { style: 'DARK' | 'LIGHT' }) => Promise<void>;
            setBackgroundColor?: (opts: { color: string }) => Promise<void>;
          };
        };
      };
    }).Capacitor;

    const statusBar = cap?.Plugins?.StatusBar;
    if (!statusBar) return;

    const isDark = state.theme === 'dark';
    void statusBar.setOverlaysWebView?.({ overlay: false }).catch(() => {});
    void statusBar.setStyle?.({ style: isDark ? 'DARK' : 'LIGHT' }).catch(() => {});
    void statusBar.setBackgroundColor?.({ color: isDark ? '#0f172a' : '#ffffff' }).catch(() => {});
  }, [state.theme]);

  const handleQuickNewPage = () => {
    const targetSection =
      activeSection ?? state.sections.find((s) => s.notebookId === activeNotebook?.id) ?? state.sections[0];
    if (targetSection) {
      createPage(
        targetSection.id,
        null,
        '',
        activePage?.paperStyle ?? 'ruled',
        activePage?.pageFormat,
        activePage?.pageColor ?? 'auto'
      );
    } else {
      setActiveView('shelf');
    }
  };

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 pb-[env(safe-area-inset-bottom)]">
      {/* Top Application Header */}
      <header className="no-print shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pt-[env(safe-area-inset-top)]">
        <div className="flex h-13 sm:h-14 items-center justify-between gap-2 pl-[max(0.625rem,env(safe-area-inset-left))] pr-[max(0.625rem,env(safe-area-inset-right))] sm:px-5">
        {/* Left: Sidebar Toggle + Brand Wordmark */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setSidebarOpenMobile(true)}
            className="lg:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Abrir navegação"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setSidebarOpenDesktop((v) => !v)}
            className="hidden lg:flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            title={sidebarOpenDesktop ? 'Recolher painel lateral' : 'Expandir painel lateral'}
          >
            {sidebarOpenDesktop ? (
              <PanelLeftClose className="w-4.5 h-4.5" />
            ) : (
              <PanelLeftOpen className="w-4.5 h-4.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveView('shelf')}
            className="flex items-center gap-2 font-display text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <BookOpen className="w-4 h-4" />
            </span>
            <span>FolioNotes</span>
          </button>

          {/* Subtle Breadcrumb on larger screens */}
          {state.activeView === 'editor' && activeNotebook && (
            <div className="hidden lg:flex items-center gap-1.5 pl-2 text-xs text-slate-400 dark:text-slate-500 truncate">
              <span>/</span>
              <button
                type="button"
                onClick={() => setActiveView('shelf')}
                className="hover:text-slate-700 dark:hover:text-slate-200 truncate max-w-[160px] cursor-pointer"
              >
                {activeNotebook.title}
              </button>
              {activeSection && (
                <>
                  <span>/</span>
                  <span className="truncate max-w-[140px] font-medium" style={{ color: activeSection.color }}>
                    {activeSection.name}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: Shelf Button, Theme Switch, PWA Install, New Page CTA */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveView(state.activeView === 'shelf' ? 'editor' : 'shelf')}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 sm:px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title={state.activeView === 'shelf' ? 'Voltar ao Editor' : 'Estante de Cadernos'}
          >
            <FolderKanban className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden md:inline">
              {state.activeView === 'shelf' ? 'Voltar ao Editor' : 'Estante'}
            </span>
          </button>

          <PWAInstallButton />

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={state.theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
            title={state.theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {state.theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={handleQuickNewPage}
            title="Nova Página"
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-indigo-600 px-2.5 sm:px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Nova Página</span>
          </button>
        </div>
        </div>
      </header>

      {/* Main Workspace Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop / Tablet Collapsible Sidebar */}
        {sidebarOpenDesktop && (
          <div className="hidden lg:block h-full shrink-0">
            <HierarchySidebar />
          </div>
        )}

        {/* Mobile Drawer Sidebar */}
        {sidebarOpenMobile && (
          <div className="no-print fixed inset-0 z-50 flex lg:hidden">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
              onClick={() => setSidebarOpenMobile(false)}
            />
            <div className="relative z-10 h-full flex">
              <HierarchySidebar onCloseMobile={() => setSidebarOpenMobile(false)} />
              <button
                type="button"
                onClick={() => setSidebarOpenMobile(false)}
                className="ml-2 mt-3 flex h-9 w-9 items-center justify-center rounded-full bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-lg"
                aria-label="Fechar navegação"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Active View Content */}
        <main className="flex flex-1 min-w-0 h-full overflow-hidden">
          {state.activeView === 'shelf' && <NotebookShelf />}
          {state.activeView === 'editor' && <NoteEditor />}
          {state.activeView === 'favorites' && <FavoritesAndTrashView mode="favorites" />}
          {state.activeView === 'trash' && <FavoritesAndTrashView mode="trash" />}
        </main>
      </div>

      <OfflineIndicator />
    </div>
  );
};

export default function App() {
  return (
    <NotesProvider>
      <WorkspaceShell />
    </NotesProvider>
  );
}
