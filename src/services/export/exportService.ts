import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { NotePage, ThemeMode, WorkspaceState } from '../../types/notes';
import { exportDrawingToPngDataUrl } from '../../utils/canvasRender';
import { exportPagesToLayeredPdf } from '../pdf/pdfExportService';

function slugifyFilename(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'nota'
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportPageToMarkdown(page: NotePage, contextLabel?: string) {
  const lines: string[] = [`# ${page.title || 'Nota sem título'}`];
  if (contextLabel) {
    lines.push(`*${contextLabel}*`);
  }
  if (page.pdfBackground) {
    lines.push(
      `*[Documento PDF: ${page.pdfBackground.fileName} — Página ${page.pdfBackground.pageNumber} de ${page.pdfBackground.totalPages}]*`
    );
  }
  lines.push('');

  let numberedCounter = 1;
  for (const block of page.blocks) {
    if (block.type !== 'numbered') numberedCounter = 1;

    switch (block.type) {
      case 'h1':
        lines.push(`# ${block.content}`, '');
        break;
      case 'h2':
        lines.push(`## ${block.content}`, '');
        break;
      case 'h3':
        lines.push(`### ${block.content}`, '');
        break;
      case 'paragraph':
        lines.push(block.content, '');
        break;
      case 'bullet':
        lines.push(`- ${block.content}`);
        break;
      case 'numbered':
        lines.push(`${numberedCounter++}. ${block.content}`);
        break;
      case 'checklist':
        lines.push(`- [${block.checked ? 'x' : ' '}] ${block.content}`);
        break;
      case 'quote':
        lines.push(`> ${block.content}`, '');
        break;
      case 'callout':
        lines.push(`> **Destaque:** ${block.content}`, '');
        break;
      case 'code':
        lines.push('```', block.content, '```', '');
        break;
      case 'table':
        if (block.table) {
          lines.push(`| ${block.table.headers.join(' | ')} |`);
          lines.push(`| ${block.table.headers.map(() => '---').join(' | ')} |`);
          for (const row of block.table.rows) {
            lines.push(`| ${row.join(' | ')} |`);
          }
          lines.push('');
        }
        break;
      case 'drawing':
        lines.push(`*[Bloco de Desenho: ${block.content || 'Rascunho à mão'}]*`, '');
        break;
      case 'image':
        if (block.image?.url) {
          lines.push(`![${block.image.caption || 'Imagem'}](${block.image.url})`, '');
        }
        break;
      case 'audio':
        if (block.audio) {
          lines.push(`*[Áudio gravado: ${block.audio.label} (${block.audio.durationSec}s)]*`, '');
        }
        break;
      case 'link':
        if (block.link) {
          lines.push(`[${block.link.title || block.link.url}](${block.link.url})`, '');
        }
        break;
    }
  }

  const mdBlob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(mdBlob, `${slugifyFilename(page.title)}.md`);
}

export function exportPageToPdf() {
  window.print();
}

export async function exportPagesAsLayeredPdf(
  pages: NotePage[],
  options: {
    baseName: string;
    appTheme: ThemeMode;
    sheetAspectRatios?: Record<string, number>;
    onProgress?: (current: number, total: number) => void;
  }
): Promise<void> {
  const filename = `${slugifyFilename(options.baseName)}.pdf`;
  await exportPagesToLayeredPdf(pages, {
    filename,
    appTheme: options.appTheme,
    sheetAspectRatios: options.sheetAspectRatios,
    onProgress: options.onProgress,
  });
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array | null {
  try {
    const base64 = dataUrl.split(',')[1];
    if (!base64) return null;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

export async function exportPageToDocx(page: NotePage, contextLabel?: string) {
  const children: Array<Paragraph | Table> = [
    new Paragraph({
      text: page.title || 'Nota sem título',
      heading: HeadingLevel.TITLE,
      spacing: { after: 140 },
    }),
  ];

  if (contextLabel) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: contextLabel,
            color: '64748B',
            size: 20,
            italics: true,
          }),
        ],
        spacing: { after: 280 },
      })
    );
  }

  if (page.pdfBackground) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Documento PDF: ${page.pdfBackground.fileName} (Página ${page.pdfBackground.pageNumber} de ${page.pdfBackground.totalPages})`,
            color: '475569',
            size: 18,
            italics: true,
          }),
        ],
        spacing: { after: 200 },
      })
    );
  }

  let numberedIndex = 1;
  for (const block of page.blocks) {
    if (block.type !== 'numbered') numberedIndex = 1;

    switch (block.type) {
      case 'h1':
        children.push(new Paragraph({ text: block.content, heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } }));
        break;
      case 'h2':
        children.push(new Paragraph({ text: block.content, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
        break;
      case 'h3':
        children.push(new Paragraph({ text: block.content, heading: HeadingLevel.HEADING_3, spacing: { before: 160, after: 80 } }));
        break;
      case 'paragraph':
        children.push(new Paragraph({ text: block.content, spacing: { after: 140 } }));
        break;
      case 'bullet':
        children.push(
          new Paragraph({
            text: block.content,
            bullet: { level: 0 },
            spacing: { after: 80 },
          })
        );
        break;
      case 'numbered':
        children.push(
          new Paragraph({
            text: `${numberedIndex++}. ${block.content}`,
            indent: { left: 360 },
            spacing: { after: 80 },
          })
        );
        break;
      case 'checklist':
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: block.checked ? '☑ ' : '☐ ', bold: true }),
              new TextRun({ text: block.content, strike: !!block.checked }),
            ],
            indent: { left: 240 },
            spacing: { after: 80 },
          })
        );
        break;
      case 'quote':
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `“${block.content}”`, italics: true, color: '475569' })],
            indent: { left: 420 },
            spacing: { before: 100, after: 140 },
          })
        );
        break;
      case 'callout':
        children.push(
          new Paragraph({
            children: [new TextRun({ text: block.content, color: '1E293B' })],
            shading: { type: ShadingType.CLEAR, fill: 'EEF2FF' },
            border: {
              top: { style: BorderStyle.SINGLE, size: 4, color: 'C7D2FE' },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: 'C7D2FE' },
              left: { style: BorderStyle.SINGLE, size: 4, color: 'C7D2FE' },
              right: { style: BorderStyle.SINGLE, size: 4, color: 'C7D2FE' },
            },
            spacing: { before: 120, after: 160 },
          })
        );
        break;
      case 'code':
        children.push(
          new Paragraph({
            children: [new TextRun({ text: block.content, font: 'Courier New', size: 20 })],
            shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
            spacing: { before: 120, after: 160 },
          })
        );
        break;
      case 'table':
        if (block.table) {
          const tableRows = [
            new TableRow({
              children: block.table.headers.map(
                (header) =>
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: 'E2E8F0' },
                    children: [new Paragraph({ children: [new TextRun({ text: header, bold: true })] })],
                  })
              ),
            }),
            ...block.table.rows.map(
              (row) =>
                new TableRow({
                  children: row.map(
                    (cell) =>
                      new TableCell({
                        children: [new Paragraph({ text: cell })],
                      })
                  ),
                })
            ),
          ];
          children.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: tableRows,
            })
          );
          children.push(new Paragraph({ text: '', spacing: { after: 140 } }));
        }
        break;
      case 'drawing':
        if (block.drawing && block.drawing.strokes.length > 0) {
          const dataUrl = exportDrawingToPngDataUrl(block.drawing.strokes, 840, block.drawing.height || 270, '#ffffff');
          const imgBytes = dataUrlToUint8Array(dataUrl);
          if (imgBytes) {
            children.push(
              new Paragraph({
                children: [
                  new ImageRun({
                    data: imgBytes,
                    transformation: { width: 520, height: Math.round(((block.drawing.height || 270) / 840) * 520) },
                    type: 'png',
                  }),
                ],
                spacing: { before: 120, after: 80 },
              })
            );
          }
          if (block.content) {
            children.push(
              new Paragraph({
                children: [new TextRun({ text: block.content, italics: true, color: '64748B', size: 18 })],
                spacing: { after: 160 },
              })
            );
          }
        }
        break;
      case 'image':
        if (block.image?.url.startsWith('data:image/')) {
          const imgBytes = dataUrlToUint8Array(block.image.url);
          if (imgBytes) {
            children.push(
              new Paragraph({
                children: [
                  new ImageRun({
                    data: imgBytes,
                    transformation: { width: 480, height: 300 },
                    type: 'png',
                  }),
                ],
                spacing: { before: 120, after: 80 },
              })
            );
          }
        }
        if (block.image?.caption) {
          children.push(new Paragraph({ children: [new TextRun({ text: block.image.caption, italics: true, color: '64748B' })] }));
        }
        break;
      case 'audio':
        if (block.audio) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: `[Nota de Áudio: ${block.audio.label} — ${block.audio.durationSec}s]`, italics: true })],
              spacing: { after: 120 },
            })
          );
        }
        break;
      case 'link':
        if (block.link) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: `${block.link.title || block.link.url} (${block.link.url})`, color: '4F46E5' })],
              spacing: { after: 120 },
            })
          );
        }
        break;
    }
  }

  if (page.inkStrokes && page.inkStrokes.length > 0) {
    const maxY = Math.max(
      760,
      ...page.inkStrokes.flatMap((s) => s.points.map((p) => p.y + 40))
    );
    const inkDataUrl = exportDrawingToPngDataUrl(page.inkStrokes, 900, Math.round(maxY), '#ffffff');
    const inkBytes = dataUrlToUint8Array(inkDataUrl);
    if (inkBytes) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: 'Anotações manuscritas na folha:', bold: true, color: '475569' })],
          spacing: { before: 200, after: 80 },
        }),
        new Paragraph({
          children: [
            new ImageRun({
              data: inkBytes,
              transformation: { width: 520, height: Math.round((maxY / 900) * 520) },
              type: 'png',
            }),
          ],
          spacing: { after: 160 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `${slugifyFilename(page.title)}.docx`);
}

export function exportWorkspaceBackupJson(state: WorkspaceState) {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'FolioNotes',
    workspace: state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const dateStr = new Date().toISOString().slice(0, 10);
  triggerDownload(blob, `folionotes-backup-${dateStr}.json`);
}

export function parseWorkspaceBackupJson(rawJson: string): WorkspaceState {
  const parsed = JSON.parse(rawJson);
  const candidate = parsed?.workspace ?? parsed;
  if (
    !candidate ||
    !Array.isArray(candidate.notebooks) ||
    !Array.isArray(candidate.sections) ||
    !Array.isArray(candidate.pages)
  ) {
    throw new Error('Arquivo JSON inválido ou incompatível com o backup do FolioNotes.');
  }
  return candidate as WorkspaceState;
}
