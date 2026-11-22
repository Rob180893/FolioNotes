import React, { useEffect, useState } from 'react';
import {
  CheckSquare,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Lightbulb,
  Link2,
  List,
  ListOrdered,
  Mic,
  PenTool,
  Quote,
  Table,
  Type,
} from 'lucide-react';
import type { BlockType } from '../../types/notes';

export interface SlashCommandItem {
  type: BlockType;
  label: string;
  description: string;
  keywords: string[];
  icon: React.ReactNode;
}

export const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    type: 'paragraph',
    label: 'Texto',
    description: 'Parágrafo padrão de anotação',
    keywords: ['texto', 'paragrafo', 'p'],
    icon: <Type className="w-4 h-4" />,
  },
  {
    type: 'h1',
    label: 'Título 1',
    description: 'Cabeçalho principal de seção',
    keywords: ['h1', 'titulo', 'heading'],
    icon: <Heading1 className="w-4 h-4" />,
  },
  {
    type: 'h2',
    label: 'Título 2',
    description: 'Subtítulo intermediário',
    keywords: ['h2', 'subtitulo', 'heading'],
    icon: <Heading2 className="w-4 h-4" />,
  },
  {
    type: 'h3',
    label: 'Título 3',
    description: 'Título compacto de tópico',
    keywords: ['h3', 'topico'],
    icon: <Heading3 className="w-4 h-4" />,
  },
  {
    type: 'checklist',
    label: 'Lista de Tarefas',
    description: 'Checklist interativo com caixas de seleção',
    keywords: ['tarefa', 'checklist', 'todo', 'check'],
    icon: <CheckSquare className="w-4 h-4" />,
  },
  {
    type: 'bullet',
    label: 'Lista com Marcadores',
    description: 'Tópicos simples com marcadores',
    keywords: ['lista', 'bullet', 'marcadores'],
    icon: <List className="w-4 h-4" />,
  },
  {
    type: 'numbered',
    label: 'Lista Numerada',
    description: 'Passo a passo numerado',
    keywords: ['numerada', 'numero', 'ordered'],
    icon: <ListOrdered className="w-4 h-4" />,
  },
  {
    type: 'callout',
    label: 'Caixa de Destaque',
    description: 'Bloco colorido para avisos e resumos',
    keywords: ['destaque', 'callout', 'aviso', 'nota'],
    icon: <Lightbulb className="w-4 h-4" />,
  },
  {
    type: 'quote',
    label: 'Citação',
    description: 'Trecho destacado ou referência',
    keywords: ['citacao', 'quote'],
    icon: <Quote className="w-4 h-4" />,
  },
  {
    type: 'table',
    label: 'Tabela',
    description: 'Grade editável de linhas e colunas',
    keywords: ['tabela', 'table', 'grade'],
    icon: <Table className="w-4 h-4" />,
  },
  {
    type: 'code',
    label: 'Código / Fórmula',
    description: 'Bloco monoespaçado para código ou matemática',
    keywords: ['codigo', 'code', 'formula', 'math'],
    icon: <Code2 className="w-4 h-4" />,
  },
  {
    type: 'drawing',
    label: 'Desenho Livre (Canvas)',
    description: 'Quadro para escrita à mão, canetas e esquemas',
    keywords: ['desenho', 'canvas', 'rascunho', 'caneta'],
    icon: <PenTool className="w-4 h-4" />,
  },
  {
    type: 'image',
    label: 'Imagem',
    description: 'Enviar foto ou inserir imagem por URL',
    keywords: ['imagem', 'foto', 'image'],
    icon: <ImageIcon className="w-4 h-4" />,
  },
  {
    type: 'audio',
    label: 'Nota de Áudio',
    description: 'Gravar voz diretamente na página',
    keywords: ['audio', 'voz', 'gravar', 'mic'],
    icon: <Mic className="w-4 h-4" />,
  },
  {
    type: 'link',
    label: 'Link / Referência',
    description: 'Cartão de marcador para página externa',
    keywords: ['link', 'url', 'site'],
    icon: <Link2 className="w-4 h-4" />,
  },
];

interface SlashCommandMenuProps {
  query: string;
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({ query, onSelect, onClose }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const normalizedQuery = query.toLowerCase().trim();
  const filtered = SLASH_COMMANDS.filter((item) => {
    if (!normalizedQuery) return true;
    return (
      item.label.toLowerCase().includes(normalizedQuery) ||
      item.description.toLowerCase().includes(normalizedQuery) ||
      item.keywords.some((k) => k.includes(normalizedQuery))
    );
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [normalizedQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (filtered.length > 0 ? (prev + 1) % filtered.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : 0));
      } else if (e.key === 'Enter') {
        if (filtered[selectedIndex]) {
          e.preventDefault();
          onSelect(filtered[selectedIndex].type);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [filtered, selectedIndex, onSelect, onClose]);

  return (
    <div className="no-print absolute left-0 top-full z-40 mt-1.5 w-72 max-h-72 overflow-y-auto scrollbar-thin rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 shadow-xl">
      <div className="px-2.5 py-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
        Inserir bloco
      </div>
      {filtered.length === 0 ? (
        <div className="px-3 py-4 text-center text-xs text-slate-500">
          Nenhum bloco encontrado para “/{query}”
        </div>
      ) : (
        filtered.map((item, idx) => (
          <button
            key={item.type}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(item.type);
            }}
            onMouseEnter={() => setSelectedIndex(idx)}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors cursor-pointer ${
              idx === selectedIndex
                ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-200'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {item.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold truncate">{item.label}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{item.description}</div>
            </div>
          </button>
        ))
      )}
    </div>
  );
};
