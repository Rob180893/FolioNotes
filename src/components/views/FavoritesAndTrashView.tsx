import React from 'react';
import { RotateCcw, Star, Trash2 } from 'lucide-react';
import { useNotesStore } from '../../store/useNotesStore';

interface FavoritesAndTrashViewProps {
  mode: 'favorites' | 'trash';
}

export const FavoritesAndTrashView: React.FC<FavoritesAndTrashViewProps> = ({ mode }) => {
  const {
    state,
    selectPage,
    updatePage,
    restorePage,
    permanentlyDeletePage,
    emptyTrash,
  } = useNotesStore();

  const items = state.pages
    .filter((p) => (mode === 'favorites' ? !p.isDeleted && p.isFavorite : p.isDeleted))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin bg-slate-50 dark:bg-slate-950 p-6 sm:p-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-50">
              {mode === 'favorites' ? 'Notas Favoritas' : 'Lixeira'}
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {mode === 'favorites'
                ? 'Acesso rápido às páginas marcadas com estrela.'
                : 'Páginas removidas ficam armazenadas aqui até serem restauradas ou excluídas.'}
            </p>
          </div>

          {mode === 'trash' && items.length > 0 && (
            <button
              type="button"
              onClick={emptyTrash}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-rose-700 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Esvaziar Lixeira</span>
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {mode === 'favorites'
                ? 'Nenhuma nota favoritada ainda. Clique na estrela no topo de qualquer página para fixá-la aqui.'
                : 'A lixeira está vazia.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            {items.map((pg) => {
              const sec = state.sections.find((s) => s.id === pg.sectionId);
              const nb = sec ? state.notebooks.find((n) => n.id === sec.notebookId) : null;
              const preview = pg.blocks.find((b) => b.content.trim())?.content || 'Sem conteúdo textual';

              return (
                <div
                  key={pg.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div
                    onClick={() => {
                      if (mode === 'favorites') selectPage(pg.id);
                    }}
                    className={`min-w-0 flex-1 ${mode === 'favorites' ? 'cursor-pointer' : ''}`}
                  >
                    <div className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {pg.title || 'Sem título'}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">{preview}</p>
                    <div className="mt-1 text-[11px] text-slate-400">
                      {nb?.title} {sec ? `· ${sec.name}` : ''}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {mode === 'favorites' ? (
                      <button
                        type="button"
                        onClick={() => updatePage(pg.id, { isFavorite: false })}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 cursor-pointer"
                      >
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span>Desfavoritar</span>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => restorePage(pg.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restaurar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => permanentlyDeletePage(pg.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900 px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Excluir</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
