import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type AssistAction = 'summarize' | 'organize' | 'tasks' | 'ocr';

interface AssistRequestBody {
  action: AssistAction;
  title?: string;
  content?: string;
  imageDataUrl?: string;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no servidor.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  const mimeType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
  return { mimeType, data: match[2] };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '15mb' }));

  app.use('/api', (_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (_req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/ai/assist', async (req, res) => {
    try {
      const body = req.body as AssistRequestBody;
      const validActions: AssistAction[] = ['summarize', 'organize', 'tasks', 'ocr'];

      if (!body || !validActions.includes(body.action)) {
        res.status(400).json({ error: 'Ação de IA inválida.' });
        return;
      }

      const ai = getGeminiClient();
      const pageTitle = typeof body.title === 'string' ? body.title.slice(0, 300) : 'Sem título';
      const pageContent = typeof body.content === 'string' ? body.content.slice(0, 30000) : '';

      if (body.action === 'summarize') {
        if (!pageContent.trim()) {
          res.status(400).json({ error: 'A página não possui texto suficiente para resumir.' });
          return;
        }

        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Título da Nota: ${pageTitle}\n\nConteúdo:\n${pageContent}`,
          config: {
            systemInstruction:
              'Você é um assistente editorial especialista em organização pessoal (Português do Brasil). Crie um resumo claro e objetivo em tópicos curtos sobre a nota fornecida. Retorne JSON estrito.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summaryTitle: { type: Type.STRING },
                bullets: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['summaryTitle', 'bullets'],
            },
          },
        });

        const parsed = JSON.parse((response.text ?? '{}').trim());
        res.json({ result: parsed });
        return;
      }

      if (body.action === 'organize') {
        if (!pageContent.trim()) {
          res.status(400).json({ error: 'A página não possui texto para organizar e revisar.' });
          return;
        }

        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Título da Nota: ${pageTitle}\n\nTexto bruto para revisar e estruturar:\n${pageContent}`,
          config: {
            systemInstruction:
              'Você é um editor especialista em clareza e gramática (Português do Brasil). Corrija erros gramaticais e transforme as anotações em blocos estruturados por seções lógicas. Use tipos válidos: "h2", "paragraph", "bullet", "checklist", "callout". Retorne apenas JSON válido.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                blocks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING },
                      content: { type: Type.STRING },
                    },
                    required: ['type', 'content'],
                  },
                },
              },
              required: ['blocks'],
            },
          },
        });

        const parsed = JSON.parse((response.text ?? '{"blocks":[]}').trim());
        res.json({ result: parsed });
        return;
      }

      if (body.action === 'tasks') {
        if (!pageContent.trim()) {
          res.status(400).json({ error: 'Adicione conteúdo na nota para extrair tarefas.' });
          return;
        }

        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Título da Nota: ${pageTitle}\n\nConteúdo:\n${pageContent}`,
          config: {
            systemInstruction:
              'Você é um gerente de produtividade. Extraia todas as ações, próximos passos ou compromissos implícitos e explícitos do texto em uma lista objetiva de tarefas acionáveis em Português do Brasil. Retorne apenas JSON.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                tasks: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['tasks'],
            },
          },
        });

        const parsed = JSON.parse((response.text ?? '{"tasks":[]}').trim());
        res.json({ result: parsed });
        return;
      }

      if (body.action === 'ocr') {
        if (typeof body.imageDataUrl !== 'string' || !body.imageDataUrl) {
          res.status(400).json({ error: 'Selecione um rascunho ou envie uma imagem para converter em texto.' });
          return;
        }

        const parsedImg = parseDataUrl(body.imageDataUrl);
        if (!parsedImg) {
          res.status(400).json({ error: 'Formato de imagem inválido. Envie PNG, JPEG ou WEBP.' });
          return;
        }

        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: parsedImg.mimeType,
                  data: parsedImg.data,
                },
              },
              {
                text: 'Transcreva fielmente o conteúdo escrito à mão, texto impresso, diagramas ou listas desta imagem para blocos estruturados em Português. Se houver setas ou mapas mentais, organize em título ("h2"), tópicos ("bullet"), tarefas ("checklist") ou parágrafos ("paragraph"). Se houver fórmulas ou código, use "code".',
              },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                blocks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING },
                      content: { type: Type.STRING },
                    },
                    required: ['type', 'content'],
                  },
                },
              },
              required: ['blocks'],
            },
          },
        });

        const parsed = JSON.parse((response.text ?? '{"blocks":[]}').trim());
        res.json({ result: parsed });
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao processar solicitação no Assistente IA.';
      console.error('AI Assist Error:', error);
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FolioNotes server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
