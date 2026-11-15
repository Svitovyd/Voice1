import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Helper to get a GoogleGenAI client with current environment key
function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY || '';
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// In-memory cache to avoid redundant TTS quota usage for identical requests
interface CachedAudio {
  audioBase64: string;
  model: string;
  voice: string;
  timestamp: number;
}
const ttsCache = new Map<string, CachedAudio>();

function getCacheKey(text: string, voiceName: string, style: string): string {
  return crypto
    .createHash('sha256')
    .update(`${voiceName}::${style}::${text.trim()}`)
    .digest('hex');
}

function isQuotaExhaustedError(error: any): boolean {
  if (!error) return false;
  if (error.status === 429 || error.code === 429) return true;
  const msg = String(error.message || '');
  return (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('Quota exceeded')
  );
}

// Status endpoint to check server & API configuration
app.get('/api/status', (_req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    model: 'gemini-3.8-flash-tts',
    liveModel: 'gemini-3.8-live',
    fallbackModel: 'gemini-3.8-flash-lite-tts',
    supportedVoices: [
      { id: 'Charon', name: 'Charon (Глибокий, сповідальний)', gender: 'male', description: 'Низький, задумливий оксамитовий тембр' },
      { id: 'Fenrir', name: 'Fenrir (Суворий, твердий)', gender: 'male', description: 'Стриманий, глибокий та проникливий голос' },
      { id: 'Puck', name: 'Puck (Іронічний, їдкий)', gender: 'male', description: 'Живий тембр з саркастичним підтекстом' },
      { id: 'Kore', name: 'Kore (Чуттєвий драматичний)', gender: 'female', description: 'Виразний, глибокий та емоційний жіночий голос' },
      { id: 'Zephyr', name: 'Zephyr (Ніжний, меланхолійний)', gender: 'female', description: 'М’який, спокійний жіночий тембр' },
    ],
  });
});

// Text-to-Speech Endpoint using gemini-3.8-flash-tts with automatic fallback to gemini-3.8-flash-lite-tts on quota exhaustion
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voiceName = 'Charon', style } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Текст для озвучення є обов’язковим.',
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'GEMINI_API_KEY не знайдено на сервері. Будь ласка, перевірте ключ у панелі Settings > Secrets.',
        fallbackAvailable: true,
      });
    }

    const isFemaleVoice = voiceName === 'Kore' || voiceName === 'Zephyr';
    const speechStyle =
      style ||
      (isFemaleVoice
        ? 'Dramatic female confession, expressive Ukrainian woman voice, wounded pride, slow deliberate cadence, bitter irony during laughter, reflective pauses'
        : 'Dramatic male confession, deep Ukrainian voice, wounded pride, slow deliberate cadence, bitter irony during laughter, reflective pauses');

    const cacheKey = getCacheKey(text, voiceName, speechStyle);
    const cached = ttsCache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        audioBase64: cached.audioBase64,
        mimeType: 'audio/wav',
        voice: cached.voice,
        model: cached.model,
        cached: true,
      });
    }

    const ai = getAiClient();
    let usedModel = 'gemini-3.8-flash-tts';
    let response;

    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: text.trim(),
                speechMetadata: {
                  style: speechStyle,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });
    } catch (primaryError: any) {
      if (isQuotaExhaustedError(primaryError)) {
        usedModel = 'gemini-3.8-flash-lite-tts';
        const cleanedText = text
          .replace(/<laugh>/g, '')
          .replace(/<breath>/g, '')
          .replace(/<gasp>/g, '')
          .trim();

        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: cleanedText,
                  speechMetadata: {
                    style: speechStyle,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        });
      } else {
        throw primaryError;
      }
    }

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      return res.status(502).json({
        success: false,
        error: 'Модель не повернула аудіодані. Спробуйте ще раз.',
      });
    }

    ttsCache.set(cacheKey, {
      audioBase64: base64Audio,
      model: usedModel,
      voice: voiceName,
      timestamp: Date.now(),
    });

    return res.json({
      success: true,
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
      voice: voiceName,
      model: usedModel,
    });
  } catch (error: any) {
    if (isQuotaExhaustedError(error)) {
      return res.status(429).json({
        success: false,
        isQuotaError: true,
        fallbackAvailable: true,
        error:
          'Вичерпано денний ліміт безкоштовного тарифу (Free Tier: 10 запитів/день для Gemini TTS). Щоб збільшити квоту, оберіть API-ключ із активованим білінгом у панелі Settings > Secrets.',
      });
    }

    const status = error.status || 500;
    let message = 'Помилка генерації голосу.';
    if (status === 403 || status === 400) {
      message =
        'Помилка доступу до API. Будь ласка, перевірте ваш GEMINI_API_KEY у панелі Settings > Secrets.';
    } else if (error.message) {
      message = error.message;
    }

    return res.status(status).json({
      success: false,
      error: message,
    });
  }
});

// Create HTTP server wrapping Express
const server = http.createServer(app);

// Setup WebSocket Server for Gemini Live API (gemini-3.8-live)
const wss = new WebSocketServer({ server, path: '/api/live' });

wss.on('connection', async (clientWs: WebSocket, req) => {
  const urlParams = new URLSearchParams((req.url || '').split('?')[1] || '');
  const requestedVoice = urlParams.get('voice') || 'Charon';
  const allowedVoices = ['Charon', 'Fenrir', 'Puck', 'Kore', 'Zephyr'];
  const liveVoiceName = allowedVoices.includes(requestedVoice) ? requestedVoice : 'Charon';
  const isFemaleLive = liveVoiceName === 'Kore' || liveVoiceName === 'Zephyr';

  console.log(`[Live API] Client connected to live session (voice: ${liveVoiceName})`);

  if (!process.env.GEMINI_API_KEY) {
    clientWs.send(
      JSON.stringify({
        error: 'GEMINI_API_KEY не знайдено на сервері. Перевірте Settings > Secrets.',
      })
    );
    clientWs.close();
    return;
  }

  let session: any = null;

  try {
    const ai = getAiClient();
    const systemInstruction = isFemaleLive
      ? 'Ти — чуттєва, прониклива жіноча співрозмовниця українською мовою. Твоя тема — філософія стосунків, ціна мовчання та ігнорування, почуття власної гідності та психологія самотності. Спілкуйся спокійно, тепло, з щирим співчуттям та виразним жіночим голосом. Відповідай коротко і природно, як у живій розмові віч-на-віч.'
      : 'Ти — глибокий, проникливий чоловічий співрозмовник українською мовою. Твоя тема — філософія стосунків, ціна мовчання та ігнорування, почуття власної гідності та психологія самотності. Спілкуйся спокійно, тепло, з оксамитовим глибоким голосом та щирим співчуттям. Відповідай коротко і природно, як у живій розмові віч-на-віч.';

    session = await ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: liveVoiceName },
          },
        },
        systemInstruction,
      },
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          for (const part of message.serverContent?.modelTurn?.parts ?? []) {
            if (part.inlineData?.data) {
              clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
            }
          }
          if (message.serverContent?.interrupted) {
            clientWs.send(JSON.stringify({ interrupted: true }));
          }
        },
      },
    });

    clientWs.send(JSON.stringify({ ready: true, voice: liveVoiceName, model: 'gemini-3.8-live' }));

    clientWs.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.audio && session) {
          session.sendRealtimeInput({
            audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        }
      } catch (err) {
        console.error('[Live API] Error processing client message:', err);
      }
    });

    clientWs.on('close', () => {
      console.log('[Live API] Client disconnected');
      try {
        if (session) session.close();
      } catch {}
    });
  } catch (err: any) {
    console.error('[Live API] Connection error:', err);
    clientWs.send(
      JSON.stringify({
        error: err.message || 'Не вдалося підключитися до Gemini Live API.',
      })
    );
    clientWs.close();
  }
});

// Development or Production handler
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running on http://0.0.0.0:${PORT} with WebSocket /api/live (${isProduction ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});
