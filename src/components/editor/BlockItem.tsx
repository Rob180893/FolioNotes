import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ExternalLink,
  ImagePlus,
  Info,
  Lightbulb,
  Link2,
  Plus,
  Quote as QuoteIcon,
  ScanText,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import type { BlockType, NoteBlock, PenTool } from '../../types/notes';
import { SlashCommandMenu } from './SlashCommandMenu';
import { DrawingCanvasBlock } from '../canvas/DrawingCanvasBlock';
import { AudioRecorderBlock } from '../media/AudioRecorderBlock';

interface BlockItemProps {
  block: NoteBlock;
  numberedIndex: number;
  isFirst: boolean;
  isLast: boolean;
  autoFocus?: boolean;
  penTool?: PenTool;
  penColor?: string;
  penWidth?: number;
  isSheetDark?: boolean;
  onUpdate: (patch: Partial<NoteBlock>) => void;
  onConvertType: (newType: BlockType) => void;
  onInsertAfter: (type: BlockType) => void;
  onDelete: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onRunOcr: (imageDataUrl: string) => void;
  isOcrLoading: boolean;
}

function isSafeExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export const BlockItem: React.FC<BlockItemProps> = ({
  block,
  numberedIndex,
  isFirst,
  isLast,
  autoFocus = false,
  penTool,
  penColor,
  penWidth,
  isSheetDark = false,
  onUpdate,
  onConvertType,
  onInsertAfter,
  onDelete,
  onMove,
  onRunOcr,
  isOcrLoading,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [slashDismissed, setSlashDismissed] = useState(false);

  const isTextBlock = ['h1', 'h2', 'h3', 'paragraph', 'bullet', 'numbered', 'checklist', 'quote', 'callout', 'code'].includes(
    block.type
  );

  const showSlashMenu = isTextBlock && block.content.startsWith('/') && !slashDismissed;
  const slashQuery = showSlashMenu ? block.content.slice(1) : '';

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    resizeTextarea();
  }, [block.content, block.type]);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleTextChange = (value: string) => {
    if (!value.startsWith('/')) {
      setSlashDismissed(false);
    }
    onUpdate({ content: value });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSlashMenu && ['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey && block.type !== 'code') {
      e.preventDefault();
      if ((block.type === 'bullet' || block.type === 'numbered' || block.type === 'checklist') && block.content.trim() === '') {
        onConvertType('paragraph');
        return;
      }
      const nextType: BlockType =
        block.type === 'bullet' || block.type === 'numbered' || block.type === 'checklist'
          ? block.type
          : 'paragraph';
      onInsertAfter(nextType);
    } else if (e.key === 'Backspace' && block.content === '') {
      if (block.type !== 'paragraph') {
        e.preventDefault();
        onConvertType('paragraph');
      } else if (!isFirst || !isLast) {
        e.preventDefault();
        onDelete();
      }
    }
  };

  const handleSlashSelect = (type: BlockType) => {
    setSlashDismissed(false);
    onConvertType(type);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const url = typeof reader.result === 'string' ? reader.result : '';
      if (url) {
        onUpdate({
          image: {
            url,
            caption: block.image?.caption || file.name.replace(/\.[^/.]+$/, ''),
          },
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const renderTextEditor = (className: string, placeholder: string) => (
    <textarea
      ref={textareaRef}
      rows={1}
      value={block.content}
      onChange={(e) => handleTextChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={`w-full resize-none overflow-hidden bg-transparent focus:outline-none text-[var(--sheet-ink)] placeholder:text-[var(--sheet-placeholder)] ${className}`}
    />
  );

  const renderBody = () => {
    switch (block.type) {
      case 'h1':
        return renderTextEditor(
          'font-display text-2xl sm:text-[26px] font-bold tracking-tight leading-snug pt-2',
          'Título principal (digite / para comandos)'
        );
      case 'h2':
        return renderTextEditor(
          'font-display text-xl font-semibold tracking-tight leading-snug pt-1',
          'Subtítulo'
        );
      case 'h3':
        return renderTextEditor(
          'font-display text-base font-semibold leading-snug pt-0.5',
          'Tópico'
        );
      case 'paragraph':
        return renderTextEditor(
          'text-[15px] leading-[32px]',
          'Escreva aqui ou digite "/" para inserir blocos...'
        );
      case 'bullet':
        return (
          <div className="flex items-start gap-3">
            <span className="mt-[13px] h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
            {renderTextEditor('text-[15px] leading-[32px]', 'Item da lista...')}
          </div>
        );
      case 'numbered':
        return (
          <div className="flex items-start gap-2.5">
            <span className="mt-[3px] min-w-[20px] font-mono text-sm font-medium tabular-nums text-indigo-500 leading-[26px]">
              {numberedIndex}.
            </span>
            {renderTextEditor('text-[15px] leading-[32px]', 'Item numerado...')}
          </div>
        );
      case 'checklist':
        return (
          <div className="flex items-start gap-2.5">
            <button
              type="button"
              onClick={() => onUpdate({ checked: !block.checked })}
              aria-label={block.checked ? 'Desmarcar tarefa' : 'Marcar tarefa como concluída'}
              className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <span
                className={`flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border transition-colors ${
                  block.checked
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : isSheetDark
                    ? 'border-slate-500 bg-slate-800 hover:border-indigo-400'
                    : 'border-slate-300 bg-white hover:border-indigo-500'
                }`}
              >
                {block.checked && <Check className="w-3 h-3 stroke-[3]" />}
              </span>
            </button>
            {renderTextEditor(
              `text-[15px] leading-[32px] transition-colors ${
                block.checked ? 'line-through opacity-50' : ''
              }`,
              'Descreva uma tarefa...'
            )}
          </div>
        );
      case 'quote':
        return (
          <div
            className="flex items-start gap-3 rounded-xl border px-4 py-3"
            style={{ borderColor: 'var(--sheet-border)', backgroundColor: 'var(--sheet-surface)' }}
          >
            <QuoteIcon className="w-4 h-4 mt-1 shrink-0 text-indigo-500" />
            {renderTextEditor('text-[15px] italic leading-relaxed', 'Digite uma citação...')}
          </div>
        );
      case 'callout': {
        const tone = block.calloutTone || 'info';
        const toneStyles = isSheetDark
          ? {
              info: 'border-indigo-800/70 bg-indigo-950/45',
              tip: 'border-emerald-800/70 bg-emerald-950/45',
              warn: 'border-amber-800/70 bg-amber-950/45',
            }[tone]
          : {
              info: 'border-indigo-200/90 bg-indigo-50/80',
              tip: 'border-emerald-200/90 bg-emerald-50/80',
              warn: 'border-amber-200/90 bg-amber-50/80',
            }[tone];
        const ToneIcon = tone === 'tip' ? Lightbulb : tone === 'warn' ? AlertTriangle : Info;

        return (
          <div className={`rounded-xl border px-4 py-3 ${toneStyles}`}>
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() =>
                  onUpdate({
                    calloutTone: tone === 'info' ? 'tip' : tone === 'tip' ? 'warn' : 'info',
                  })
                }
                title="Alternar estilo do destaque"
                className="no-print mt-0.5 shrink-0 text-indigo-500 hover:opacity-75 cursor-pointer"
              >
                <ToneIcon className="w-4 h-4" />
              </button>
              {renderTextEditor('text-sm leading-relaxed', 'Escreva um destaque ou resumo...')}
            </div>
          </div>
        );
      }
      case 'code':
        return (
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-900 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 px-3.5 py-1.5">
              <input
                type="text"
                value={block.codeLanguage || ''}
                onChange={(e) => onUpdate({ codeLanguage: e.target.value })}
                placeholder="Linguagem ou Fórmula"
                className="bg-transparent font-mono text-[11px] text-slate-400 focus:outline-none"
              />
            </div>
            <div className="p-3.5">
              {renderTextEditor(
                'font-mono text-xs sm:text-[13px] leading-relaxed text-slate-100 placeholder:text-slate-500',
                'Digite código, pseudocódigo ou fórmula matemática...'
              )}
            </div>
          </div>
        );
      case 'table': {
        const table = block.table || {
          headers: ['Coluna 1', 'Coluna 2'],
          rows: [['', '']],
        };
        const updateHeader = (colIdx: number, value: string) => {
          const nextHeaders = [...table.headers];
          nextHeaders[colIdx] = value;
          onUpdate({ table: { ...table, headers: nextHeaders } });
        };
        const updateCell = (rowIdx: number, colIdx: number, value: string) => {
          const nextRows = table.rows.map((r, ri) => (ri === rowIdx ? r.map((c, ci) => (ci === colIdx ? value : c)) : r));
          onUpdate({ table: { ...table, rows: nextRows } });
        };
        const addRow = () => {
          onUpdate({
            table: {
              ...table,
              rows: [...table.rows, table.headers.map(() => '')],
            },
          });
        };
        const addCol = () => {
          onUpdate({
            table: {
              headers: [...table.headers, `Coluna ${table.headers.length + 1}`],
              rows: table.rows.map((r) => [...r, '']),
            },
          });
        };
        const removeRow = (rowIdx: number) => {
          if (table.rows.length <= 1) return;
          onUpdate({
            table: {
              ...table,
              rows: table.rows.filter((_, idx) => idx !== rowIdx),
            },
          });
        };

        return (
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                    {table.headers.map((header, colIdx) => (
                      <th key={colIdx} className="border-r border-slate-200 dark:border-slate-700 last:border-r-0 p-2">
                        <input
                          type="text"
                          value={header}
                          onChange={(e) => updateHeader(colIdx, e.target.value)}
                          className="w-full bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
                        />
                      </th>
                    ))}
                    <th className="no-print w-8 p-1" />
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="border-b border-slate-100 dark:border-slate-800 last:border-b-0">
                      {row.map((cell, colIdx) => (
                        <td key={colIdx} className="border-r border-slate-100 dark:border-slate-800 last:border-r-0 p-2">
                          <input
                            type="text"
                            value={cell}
                            onChange={(e) => updateCell(rowIdx, colIdx, e.target.value)}
                            placeholder="—"
                            className="w-full bg-transparent text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
                          />
                        </td>
                      ))}
                      <td className="no-print p-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(rowIdx)}
                          disabled={table.rows.length <= 1}
                          className="p-1 text-slate-400 hover:text-rose-500 disabled:opacity-25 cursor-pointer"
                          title="Remover linha"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="no-print flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 px-3 py-1.5">
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                Linha
              </button>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <button
                type="button"
                onClick={addCol}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                Coluna
              </button>
            </div>
          </div>
        );
      }
      case 'drawing':
        return (
          <DrawingCanvasBlock
            drawing={block.drawing || { height: 260, strokes: [] }}
            caption={block.content}
            penTool={penTool}
            penColor={penColor}
            penWidth={penWidth}
            isSheetDark={isSheetDark}
            onChangeDrawing={(nextDrawing) => onUpdate({ drawing: nextDrawing })}
            onChangeCaption={(caption) => onUpdate({ content: caption })}
            onRunOcr={onRunOcr}
            isOcrLoading={isOcrLoading}
          />
        );
      case 'image': {
        const imgUrl = block.image?.url || '';
        const isSafeImage = imgUrl.startsWith('data:image/') || isSafeExternalUrl(imgUrl);

        return (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-3.5 space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            {isSafeImage ? (
              <div className="space-y-2">
                <div className="relative overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                  <img
                    src={imgUrl}
                    alt={block.image?.caption || 'Imagem anexada'}
                    referrerPolicy="no-referrer"
                    className="max-h-96 w-full object-contain mx-auto"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <input
                    type="text"
                    value={block.image?.caption || ''}
                    onChange={(e) => onUpdate({ image: { url: imgUrl, caption: e.target.value } })}
                    placeholder="Legenda da imagem..."
                    className="flex-1 min-w-[160px] bg-transparent text-xs text-slate-600 dark:text-slate-300 focus:outline-none"
                  />
                  <div className="no-print flex items-center gap-1.5">
                    {imgUrl.startsWith('data:image/') && (
                      <button
                        type="button"
                        onClick={() => onRunOcr(imgUrl)}
                        disabled={isOcrLoading}
                        className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40 cursor-pointer"
                      >
                        <ScanText className="w-3.5 h-3.5" />
                        <span>{isOcrLoading ? 'Lendo...' : 'OCR IA'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      Trocar
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                  <ImagePlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Anexar foto de caderno, quadro ou imagem</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 cursor-pointer"
                  >
                    <ImagePlus className="w-3.5 h-3.5" />
                    <span>Enviar Imagem</span>
                  </button>
                  <input
                    type="url"
                    placeholder="ou cole URL https://..."
                    onBlur={(e) => {
                      if (isSafeExternalUrl(e.target.value)) {
                        onUpdate({ image: { url: e.target.value.trim(), caption: '' } });
                      }
                    }}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>
        );
      }
      case 'audio':
        return (
          <AudioRecorderBlock
            audio={block.audio}
            onSaveAudio={(audioData) => onUpdate({ audio: audioData })}
          />
        );
      case 'link': {
        const url = block.link?.url || '';
        const title = block.link?.title || '';
        const safeHref = isSafeExternalUrl(url) ? url.trim() : null;

        return (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-3 flex flex-col sm:flex-row sm:items-center gap-2.5">
            <Link2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => onUpdate({ link: { url, title: e.target.value } })}
                placeholder="Título do link"
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="url"
                value={url}
                onChange={(e) => onUpdate({ link: { url: e.target.value, title } })}
                placeholder="https://exemplo.com"
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {safeHref && (
              <a
                href={safeHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 dark:bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-white dark:text-slate-900 hover:opacity-90 shrink-0"
              >
                <span>Abrir</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="group relative flex items-start gap-1.5 py-1">
      {/* Left Action Handle (hover / focus) */}
      <div className="no-print flex items-center gap-0.5 pt-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
        <button
          type="button"
          onClick={() => onMove('up')}
          disabled={isFirst}
          className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-20 cursor-pointer"
          title="Mover bloco para cima"
        >
          <ArrowUp className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={() => onMove('down')}
          disabled={isLast}
          className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-20 cursor-pointer"
          title="Mover bloco para baixo"
        >
          <ArrowDown className="w-3 h-3" />
        </button>
      </div>

      {/* Block Content */}
      <div className="relative flex-1 min-w-0">
        {renderBody()}
        {showSlashMenu && (
          <SlashCommandMenu
            query={slashQuery}
            onSelect={handleSlashSelect}
            onClose={() => setSlashDismissed(true)}
          />
        )}
      </div>

      {/* Right Delete Action */}
      <button
        type="button"
        onClick={onDelete}
        className="no-print mt-1 p-1.5 rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all shrink-0 cursor-pointer"
        title="Remover bloco"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
