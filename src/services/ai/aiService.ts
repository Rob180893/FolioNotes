import type { BlockType, NoteBlock } from '../../types/notes';

export interface SummarizeResult {
  summaryTitle: string;
  bullets: string[];
}

export interface OrganizeResult {
  blocks: Array<{ type: string; content: string }>;
}

export interface TasksResult {
  tasks: string[];
}

export function extractPlainTextFromBlocks(blocks: NoteBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'h1':
          return `# ${block.content}`;
        case 'h2':
          return `## ${block.content}`;
        case 'h3':
          return `### ${block.content}`;
        case 'checklist':
          return `[${block.checked ? 'x' : ' '}] ${block.content}`;
        case 'bullet':
          return `- ${block.content}`;
        case 'numbered':
          return `1. ${block.content}`;
        case 'quote':
          return `> ${block.content}`;
        case 'callout':
          return `Nota: ${block.content}`;
        case 'code':
          return block.content;
        case 'table':
          if (!block.table) return '';
          return [block.table.headers.join(' | '), ...block.table.rows.map((r) => r.join(' | '))].join('\n');
        case 'link':
          return block.link ? `${block.link.title} (${block.link.url})` : block.content;
        case 'image':
          return block.image?.caption ? `Imagem: ${block.image.caption}` : '';
        case 'audio':
          return block.audio ? `Áudio: ${block.audio.label}` : '';
        case 'drawing':
          return block.content ? `Rascunho: ${block.content}` : '';
        default:
          return block.content;
      }
    })
    .filter((line) => line.trim().length > 0)
    .join('\n\n');
}

export function normalizeAiBlockType(rawType: string): BlockType {
  const valid: BlockType[] = ['h1', 'h2', 'h3', 'paragraph', 'bullet', 'numbered', 'checklist', 'quote', 'callout', 'code'];
  return valid.includes(rawType as BlockType) ? (rawType as BlockType) : 'paragraph';
}

async function postAssist<T>(payload: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/ai/assist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Não foi possível concluir a solicitação de IA.');
  }
  return data.result as T;
}

export async function summarizePageWithAI(title: string, blocks: NoteBlock[]): Promise<SummarizeResult> {
  const content = extractPlainTextFromBlocks(blocks);
  return postAssist<SummarizeResult>({ action: 'summarize', title, content });
}

export async function organizePageWithAI(title: string, blocks: NoteBlock[]): Promise<OrganizeResult> {
  const content = extractPlainTextFromBlocks(blocks);
  return postAssist<OrganizeResult>({ action: 'organize', title, content });
}

export async function extractTasksWithAI(title: string, blocks: NoteBlock[]): Promise<TasksResult> {
  const content = extractPlainTextFromBlocks(blocks);
  return postAssist<TasksResult>({ action: 'tasks', title, content });
}

export async function ocrImageWithAI(imageDataUrl: string, title = ''): Promise<OrganizeResult> {
  return postAssist<OrganizeResult>({ action: 'ocr', title, imageDataUrl });
}
