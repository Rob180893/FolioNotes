import type { WorkspaceState } from '../../types/notes';

const now = Date.now();

export function createInitialWorkspaceState(): WorkspaceState {
  const notebookId = 'nb-welcome';
  const secGuideId = 'sec-guide';
  const secDraftsId = 'sec-drafts';

  const pageIntroId = 'pg-intro';
  const pageChecklistId = 'pg-shortcuts';
  const pageSketchId = 'pg-sketch';
  const pageMeetingId = 'pg-meeting';

  return {
    version: 1,
    theme: 'light',
    activeView: 'editor',
    activeNotebookId: notebookId,
    activeSectionId: secGuideId,
    activePageId: pageIntroId,
    folders: [],
    notebooks: [
      {
        id: notebookId,
        folderId: null,
        title: 'Caderno de Boas-Vindas',
        description: 'Guia interativo de recursos, checklists e rascunhos visuais.',
        coverColor: '#312E81',
        coverPattern: 'linen',
        isFavorite: true,
        createdAt: now - 3600_000,
        updatedAt: now,
      },
    ],
    sections: [
      {
        id: secGuideId,
        notebookId,
        name: 'Primeiros Passos',
        color: '#4F46E5',
        order: 0,
      },
      {
        id: secDraftsId,
        notebookId,
        name: 'Ideias & Rascunhos',
        color: '#059669',
        order: 1,
      },
    ],
    pages: [
      {
        id: pageIntroId,
        sectionId: secGuideId,
        parentId: null,
        title: 'Bem-vindo ao FolioNotes',
        paperStyle: 'ruled',
        isFavorite: true,
        isDeleted: false,
        deletedAt: null,
        createdAt: now - 3600_000,
        updatedAt: now - 600_000,
        blocks: [
          {
            id: 'blk-intro-callout',
            type: 'callout',
            calloutTone: 'info',
            content:
              'Digite "/" em qualquer bloco de texto para abrir o menu rápido e inserir títulos, checklists, tabelas, áudio ou quadro de desenho.',
          },
          {
            id: 'blk-intro-h2',
            type: 'h2',
            content: 'O melhor dos dois mundos em um único espaço',
          },
          {
            id: 'blk-intro-p1',
            type: 'paragraph',
            content:
              'Organize seus projetos como no OneNote (Cadernos, Seções coloridas, Páginas e Subpáginas recuadas) com a experiência tátil de papel pautado, quadriculado, escrita à mão e áudio inspirada no Samsung Notes.',
          },
          {
            id: 'blk-intro-check-h3',
            type: 'h3',
            content: 'Checklist rápido para testar agora',
          },
          {
            id: 'blk-intro-c1',
            type: 'checklist',
            checked: true,
            content: 'Explorar o fundo pautado e alternar para quadriculado ou pontilhado no topo da folha',
          },
          {
            id: 'blk-intro-c2',
            type: 'checklist',
            checked: false,
            content: 'Desenhar no bloco de rascunho abaixo e testar "Converter Rascunho em Texto" no Assistente IA',
          },
          {
            id: 'blk-intro-c3',
            type: 'checklist',
            checked: false,
            content: 'Exportar esta página em Markdown, PDF ou Word (.docx)',
          },
          {
            id: 'blk-intro-draw-h3',
            type: 'h3',
            content: 'Quadro de Rascunho & Mapas Mentais',
          },
          {
            id: 'blk-intro-drawing',
            type: 'drawing',
            content: 'Esquema inicial — experimente desenhar com mouse, dedo ou caneta',
            drawing: {
              height: 270,
              strokes: [
                // Hand-drawn box ("IDEIA")
                {
                  id: 'st-box',
                  tool: 'fountain',
                  color: '#312E81',
                  width: 3,
                  points: [
                    { x: 64, y: 72, pressure: 0.6 },
                    { x: 184, y: 70, pressure: 0.7 },
                    { x: 186, y: 132, pressure: 0.65 },
                    { x: 62, y: 134, pressure: 0.6 },
                    { x: 64, y: 72, pressure: 0.55 },
                  ],
                },
                // Highlighter accent under box
                {
                  id: 'st-hl',
                  tool: 'highlighter',
                  color: '#FACC15',
                  width: 14,
                  points: [
                    { x: 74, y: 104, pressure: 0.5 },
                    { x: 174, y: 103, pressure: 0.5 },
                  ],
                },
                // Arrow right
                {
                  id: 'st-arrow-1',
                  tool: 'ballpoint',
                  color: '#4F46E5',
                  width: 2.5,
                  points: [
                    { x: 196, y: 102, pressure: 0.5 },
                    { x: 278, y: 102, pressure: 0.5 },
                  ],
                },
                {
                  id: 'st-arrow-tip',
                  tool: 'ballpoint',
                  color: '#4F46E5',
                  width: 2.5,
                  points: [
                    { x: 266, y: 92, pressure: 0.5 },
                    { x: 280, y: 102, pressure: 0.5 },
                    { x: 266, y: 112, pressure: 0.5 },
                  ],
                },
                // Circle node
                {
                  id: 'st-circle',
                  tool: 'fountain',
                  color: '#059669',
                  width: 3,
                  points: [
                    { x: 345, y: 66, pressure: 0.65 },
                    { x: 382, y: 76, pressure: 0.7 },
                    { x: 392, y: 106, pressure: 0.7 },
                    { x: 374, y: 134, pressure: 0.65 },
                    { x: 336, y: 136, pressure: 0.6 },
                    { x: 314, y: 108, pressure: 0.65 },
                    { x: 322, y: 76, pressure: 0.6 },
                    { x: 345, y: 66, pressure: 0.55 },
                  ],
                },
                // Branches
                {
                  id: 'st-b1',
                  tool: 'ballpoint',
                  color: '#64748B',
                  width: 2,
                  points: [
                    { x: 402, y: 92, pressure: 0.5 },
                    { x: 472, y: 66, pressure: 0.5 },
                    { x: 542, y: 66, pressure: 0.5 },
                  ],
                },
                {
                  id: 'st-b2',
                  tool: 'ballpoint',
                  color: '#64748B',
                  width: 2,
                  points: [
                    { x: 402, y: 114, pressure: 0.5 },
                    { x: 472, y: 142, pressure: 0.5 },
                    { x: 542, y: 142, pressure: 0.5 },
                  ],
                },
              ],
            },
          },
        ],
      },
      {
        id: pageChecklistId,
        sectionId: secGuideId,
        parentId: pageIntroId,
        title: 'Subpágina: Atalhos & Blocos',
        paperStyle: 'dotted',
        isFavorite: false,
        isDeleted: false,
        deletedAt: null,
        createdAt: now - 3000_000,
        updatedAt: now - 500_000,
        blocks: [
          {
            id: 'blk-sub-p1',
            type: 'paragraph',
            content:
              'Esta é uma subpágina recuada sob "Bem-vindo ao FolioNotes". Você pode criar subpáginas para detalhar tópicos sem poluir a seção principal.',
          },
          {
            id: 'blk-sub-table',
            type: 'table',
            content: 'Referência de blocos disponíveis',
            table: {
              headers: ['Comando', 'Tipo de Bloco', 'Ideal para'],
              rows: [
                ['/h1, /h2, /h3', 'Títulos', 'Estruturar seções da nota'],
                ['/tarefa', 'Checklist', 'Acompanhar entregas e metas'],
                ['/desenho', 'Canvas Livre', 'Esquemas, assinaturas e mapas'],
                ['/audio', 'Nota de Voz', 'Gravar aulas e reuniões rápido'],
              ],
            },
          },
          {
            id: 'blk-sub-code',
            type: 'code',
            codeLanguage: 'Fórmula / Código',
            content: 'E = m · c²   |   const folio = await notes.syncOffline();',
          },
        ],
      },
      {
        id: pageSketchId,
        sectionId: secDraftsId,
        parentId: null,
        title: 'Planejamento Semanal & Fluxo',
        paperStyle: 'grid',
        isFavorite: false,
        isDeleted: false,
        deletedAt: null,
        createdAt: now - 2400_000,
        updatedAt: now - 300_000,
        blocks: [
          {
            id: 'blk-sk-quote',
            type: 'quote',
            content: 'A clareza nasce quando tiramos as ideias soltas da cabeça e damos forma visual a elas.',
          },
          {
            id: 'blk-sk-b1',
            type: 'bullet',
            content: 'Revisar prioridades da semana todas as segundas-feiras',
          },
          {
            id: 'blk-sk-b2',
            type: 'bullet',
            content: 'Usar o botão "Organizar e Revisar" da IA após reuniões rápidas',
          },
        ],
      },
      {
        id: pageMeetingId,
        sectionId: secDraftsId,
        parentId: null,
        title: 'Notas de Reunião — Exemplo IA',
        paperStyle: 'plain',
        isFavorite: false,
        isDeleted: false,
        deletedAt: null,
        createdAt: now - 1800_000,
        updatedAt: now - 120_000,
        blocks: [
          {
            id: 'blk-mt-p1',
            type: 'paragraph',
            content:
              'reuniao rapida com equipe de design: precisamos finalizar prototipo ate quinta feira, joao vai revisar as cores do modo escuro e maria vai validar exportacao em pdf com o time comercial. tambem agendar teste com usuarios na proxima segunda.',
          },
        ],
      },
    ],
  };
}
