export type ThemeMode = 'light' | 'dark';

export type PaperStyle = 'plain' | 'ruled' | 'grid' | 'dotted';

export type BlockType =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'paragraph'
  | 'bullet'
  | 'numbered'
  | 'checklist'
  | 'quote'
  | 'callout'
  | 'code'
  | 'table'
  | 'drawing'
  | 'image'
  | 'audio'
  | 'link';

export type PenTool = 'ballpoint' | 'fountain' | 'highlighter' | 'eraser';

export interface DrawingPoint {
  x: number;
  y: number;
  pressure: number;
}

export interface DrawingStroke {
  id: string;
  tool: Exclude<PenTool, 'eraser'>;
  color: string;
  width: number;
  points: DrawingPoint[];
}

export interface DrawingData {
  strokes: DrawingStroke[];
  height: number;
  previewDataUrl?: string;
}

export interface TableData {
  headers: string[];
  rows: string[][];
}

export interface ImageData {
  url: string;
  caption?: string;
}

export interface AudioData {
  dataUrl: string;
  durationSec: number;
  label: string;
}

export interface LinkData {
  url: string;
  title: string;
  description?: string;
}

export interface NoteBlock {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;
  calloutTone?: 'info' | 'tip' | 'warn';
  codeLanguage?: string;
  table?: TableData;
  drawing?: DrawingData;
  image?: ImageData;
  audio?: AudioData;
  link?: LinkData;
}

export type PageFormatPreset = 'A4' | 'A5' | 'Letter' | 'Legal' | 'A4 Paisagem' | 'Custom';

export interface PageFormat {
  preset: PageFormatPreset;
  widthMm: number;
  heightMm: number;
}

export const DEFAULT_PAGE_FORMAT: PageFormat = {
  preset: 'A4',
  widthMm: 210,
  heightMm: 297,
};

export const PAGE_FORMAT_PRESETS: Array<{
  preset: Exclude<PageFormatPreset, 'Custom'>;
  label: string;
  widthMm: number;
  heightMm: number;
}> = [
  { preset: 'A4', label: 'A4 (Padrão)', widthMm: 210, heightMm: 297 },
  { preset: 'A5', label: 'A5 (Compacto)', widthMm: 148, heightMm: 210 },
  { preset: 'Letter', label: 'Carta (Letter)', widthMm: 216, heightMm: 279 },
  { preset: 'Legal', label: 'Ofício (Legal)', widthMm: 216, heightMm: 356 },
  { preset: 'A4 Paisagem', label: 'A4 Paisagem', widthMm: 297, heightMm: 210 },
];

export type PageBackgroundColor = 'auto' | 'white' | 'gray' | 'cream' | 'rose' | 'sage' | 'black';

export type ScrollDirection = 'vertical' | 'horizontal' | 'two-page';

export const PAGE_COLOR_SWATCHES: Array<{
  id: PageBackgroundColor;
  label: string;
  lightHex: string;
  darkHex: string;
  isDarkForced?: boolean;
}> = [
  { id: 'auto', label: 'Automático (segue o tema)', lightHex: '#FFFFFF', darkHex: '#171C26' },
  { id: 'gray', label: 'Cinza suave', lightHex: '#F6F7F9', darkHex: '#F6F7F9' },
  { id: 'cream', label: 'Creme papel', lightHex: '#FEFBF5', darkHex: '#FEFBF5' },
  { id: 'rose', label: 'Rosa suave', lightHex: '#FEF7F9', darkHex: '#FEF7F9' },
  { id: 'sage', label: 'Azul acinzentado', lightHex: '#F5F8F9', darkHex: '#F5F8F9' },
  { id: 'black', label: 'Preto', lightHex: '#12151C', darkHex: '#12151C', isDarkForced: true },
];

export interface PdfTextBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PdfPageBackground {
  pdfId?: string;
  aspectRatio?: number;
  dataUrl?: string;
  fileName: string;
  pageNumber: number;
  totalPages: number;
  textBoxes?: PdfTextBox[];
}

export interface NotePage {
  id: string;
  sectionId: string;
  parentId: string | null;
  title: string;
  hideTitle?: boolean;
  paperStyle: PaperStyle;
  pageFormat?: PageFormat;
  pageColor?: PageBackgroundColor;
  pdfBackground?: PdfPageBackground;
  isFavorite: boolean;
  isDeleted: boolean;
  deletedAt: number | null;
  blocks: NoteBlock[];
  inkStrokes?: DrawingStroke[];
  createdAt: number;
  updatedAt: number;
}

export interface NotebookSection {
  id: string;
  notebookId: string;
  name: string;
  color: string;
  order: number;
}

export type CoverIcon = 'book' | 'sparkles' | 'compass' | 'layers' | 'pen' | 'briefcase' | 'graduation' | 'lightbulb';

export type CoverPattern = 'solid' | 'linen' | 'stripes' | 'minimal';

export interface NotebookFolder {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export interface Notebook {
  id: string;
  folderId: string | null;
  title: string;
  description: string;
  coverColor: string;
  coverIcon?: CoverIcon;
  coverPattern: CoverPattern;
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface WorkspaceState {
  version: number;
  theme: ThemeMode;
  scrollDirection?: ScrollDirection;
  folders: NotebookFolder[];
  notebooks: Notebook[];
  sections: NotebookSection[];
  pages: NotePage[];
  activeView: 'shelf' | 'editor' | 'favorites' | 'trash';
  activeNotebookId: string | null;
  activeSectionId: string | null;
  activePageId: string | null;
}
