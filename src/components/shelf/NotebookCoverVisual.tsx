import React from 'react';
import type { CoverPattern } from '../../types/notes';

interface NotebookCoverVisualProps {
  title: string;
  color: string;
  pattern: CoverPattern;
  compact?: boolean;
}

export const NotebookCoverVisual: React.FC<NotebookCoverVisualProps> = ({
  title,
  color,
  pattern,
  compact = false,
}) => {
  const patternStyle: React.CSSProperties =
    pattern === 'linen'
      ? {
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 2px, transparent 2px, transparent 8px)',
        }
      : pattern === 'stripes'
      ? {
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(255,255,255,0.07) 0px, rgba(255,255,255,0.07) 10px, transparent 10px, transparent 22px)',
        }
      : pattern === 'minimal'
      ? {
          backgroundImage:
            'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.18), transparent 55%)',
        }
      : {};

  const longestWordLen = title
    .trim()
    .split(/\s+/)
    .reduce((max, word) => Math.max(max, word.length), 0);

  const titleSizeClass =
    longestWordLen >= 13 || title.length > 32
      ? 'text-[10px] leading-tight'
      : longestWordLen >= 9 || title.length > 18
      ? 'text-[11px] leading-snug'
      : 'text-xs sm:text-[13px] leading-snug';

  return (
    <div
      className={`relative overflow-hidden rounded-r-xl rounded-l-sm shadow-sm transition-transform duration-200 group-hover:-translate-y-0.5 ${
        compact ? 'h-24 w-20' : 'aspect-[3/4] w-full'
      }`}
      style={{ backgroundColor: color, ...patternStyle }}
    >
      {/* Tactile Spine Binding */}
      <div className="absolute inset-y-0 left-0 w-2.5 bg-black/22 border-r border-white/15" />

      {/* Elastic Band Detail */}
      {!compact && (
        <div className="absolute inset-y-0 right-2.5 w-1.5 bg-black/15 border-x border-white/10" />
      )}

      {/* Cover Label Plaque */}
      <div className="relative flex h-full flex-col justify-end p-2.5 pl-4 text-white">
        {!compact && (
          <div className="rounded-lg bg-white/95 dark:bg-slate-900/95 px-2.5 py-2 text-slate-900 dark:text-slate-100 shadow-xs">
            <div
              className={`font-display font-bold tracking-tight line-clamp-3 [overflow-wrap:normal] [word-break:normal] hyphens-none ${titleSizeClass}`}
            >
              {title}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
