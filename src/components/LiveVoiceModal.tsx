import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  Radio,
  Sparkles,
  Volume2,
  AlertCircle,
  X,
  Loader2,
} from 'lucide-react';
import {
  floatTo16BitPCMBase64,
  base64PCMToFloat32,
} from '../utils/audioEffects';
import { getVoiceGender } from '../utils/monologue';

interface LiveVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVoice?: string;
}

export const LiveVoiceModal: React.FC<LiveVoiceModalProps> = ({
  isOpen,
  onClose,
  selectedVoice = 'Charon',
}) => {
  const [status, setStatus] = useState<
    'connecting' | 'connected' | 'speaking' | 'listening' | 'error' | 'idle'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);

  // References
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const scheduleRef = useRef<{ nextStartTime: number }>({ nextStartTime: 0 });
  const isMutedRef = useRef<boolean>(false);

  isMutedRef.current = isMicMuted;

  const stopActiveAudio = () => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch {}
    });
    activeSourcesRef.current = [];
    if (outputAudioCtxRef.current) {
      scheduleRef.current.nextStartTime = outputAudioCtxRef.current.currentTime;
    }
  };

  const cleanupSession = () => {
    stopActiveAudio();

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }

    if (inputAudioCtxRef.current) {
      try {
        inputAudioCtxRef.current.close();
      } catch {}
      inputAudioCtxRef.current = null;
    }

    if (outputAudioCtxRef.current) {
      try {
        outputAudioCtxRef.current.close();
      } catch {}
      outputAudioCtxRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    setStatus('idle');
  };

  const startLiveSession = async () => {
    cleanupSession();
    setStatus('connecting');
    setErrorMessage(null);

    try {
      // 1. Microphone capture
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      micStreamRef.current = stream;

      // 2. Audio Contexts: 16kHz for Gemini input, 24kHz for Gemini output
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const inCtx = new AudioCtx({ sampleRate: 16000 });
      const outCtx = new AudioCtx({ sampleRate: 24000 });
      inputAudioCtxRef.current = inCtx;
      outputAudioCtxRef.current = outCtx;

      scheduleRef.current = { nextStartTime: outCtx.currentTime };

      // 3. Connect WebSocket with selected voice
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live?voice=${encodeURIComponent(selectedVoice)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.error) {
            setErrorMessage(msg.error);
            setStatus('error');
            return;
          }

          if (msg.interrupted) {
            stopActiveAudio();
            setStatus('listening');
            return;
          }

          if (msg.audio) {
            setStatus('speaking');
            const float32 = base64PCMToFloat32(msg.audio);
            const buffer = outCtx.createBuffer(1, float32.length, 24000);
            buffer.copyToChannel(float32 as any, 0);

            const source = outCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(outCtx.destination);

            const now = outCtx.currentTime;
            const startTime = Math.max(now, scheduleRef.current.nextStartTime);
            source.start(startTime);
            scheduleRef.current.nextStartTime = startTime + buffer.duration;

            activeSourcesRef.current.push(source);
            source.onended = () => {
              activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
              if (activeSourcesRef.current.length === 0) {
                setStatus('listening');
              }
            };
          }
        } catch (e) {
          console.error('[Live API Client] Parse error:', e);
        }
      };

      ws.onerror = () => {
        setErrorMessage('Помилка підключення до сервера Live API.');
        setStatus('error');
      };

      ws.onclose = () => {
        if (status !== 'error') {
          setStatus('idle');
        }
      };

      // 4. Send mic audio (16kHz PCM chunks)
      const micSource = inCtx.createMediaStreamSource(stream);
      const processor = inCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN && !isMutedRef.current) {
          const channelData = e.inputBuffer.getChannelData(0);
          const pcmBase64 = floatTo16BitPCMBase64(channelData);
          ws.send(JSON.stringify({ audio: pcmBase64 }));
        }
      };

      micSource.connect(processor);
      processor.connect(inCtx.destination);
    } catch (err: any) {
      console.error('[Live Session Error]', err);
      setErrorMessage(
        err.message || 'Не вдалося отримати доступ до мікрофона або встановити з’єднання.'
      );
      setStatus('error');
    }
  };

  useEffect(() => {
    if (isOpen) {
      startLiveSession();
    } else {
      cleanupSession();
    }
    return () => {
      cleanupSession();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 text-zinc-100 shadow-2xl relative overflow-hidden flex flex-col items-center">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          aria-label="Закрити діалог"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Model Badge */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
            gemini-3.8-live
          </span>
          <span className="text-xs text-zinc-400">
            Голос {selectedVoice} ({getVoiceGender(selectedVoice) === 'female' ? 'Жіночий' : 'Чоловічий'})
          </span>
        </div>

        <h3 className="text-xl font-bold font-serif text-zinc-100 mb-1 text-center">
          Розмова наживо: Сповідь та почуття
        </h3>
        <p className="text-xs text-zinc-400 text-center max-w-sm mb-6">
          Живий голосовий діалог у реальному часі. Ви можете обговорити монолог, тему ігнорування або поділитися думками.
        </p>

        {/* Glowing Orb Sphere */}
        <div className="relative w-36 h-36 flex items-center justify-center my-3">
          <div
            className={`absolute inset-0 rounded-full transition-all duration-700 blur-2xl opacity-60 ${
              status === 'speaking'
                ? 'bg-amber-500/60 scale-125 animate-pulse'
                : status === 'listening'
                ? 'bg-cyan-500/50 scale-110'
                : status === 'connecting'
                ? 'bg-indigo-500/40 animate-ping'
                : 'bg-zinc-700/30'
            }`}
          />
          <div
            className={`relative w-28 h-28 rounded-full border flex items-center justify-center shadow-2xl transition-all duration-500 ${
              status === 'speaking'
                ? 'border-amber-400 bg-amber-950/70 shadow-amber-500/30'
                : status === 'listening'
                ? 'border-cyan-400 bg-cyan-950/70 shadow-cyan-500/30'
                : status === 'connecting'
                ? 'border-indigo-400 bg-indigo-950/70 animate-pulse'
                : 'border-zinc-700 bg-zinc-950/80'
            }`}
          >
            {status === 'connecting' ? (
              <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
            ) : status === 'speaking' ? (
              <Volume2 className="w-10 h-10 text-amber-400 animate-bounce" />
            ) : status === 'listening' ? (
              <Mic className="w-10 h-10 text-cyan-400 animate-pulse" />
            ) : (
              <Sparkles className="w-10 h-10 text-zinc-400" />
            )}
          </div>
        </div>

        {/* Status text */}
        <div className="text-center mt-3 mb-6">
          <span
            className={`text-sm font-medium ${
              status === 'speaking'
                ? 'text-amber-300'
                : status === 'listening'
                ? 'text-cyan-300'
                : status === 'connecting'
                ? 'text-indigo-300'
                : 'text-zinc-400'
            }`}
          >
            {status === 'connecting' && 'Підключення до Gemini Live API...'}
            {status === 'speaking' && 'Gemini відповідає... (перебийте в будь-яку мить)'}
            {status === 'listening' && (isMicMuted ? 'Мікрофон вимкнено' : 'Слухаю вас... говоріть у мікрофон')}
            {status === 'connected' && 'З’єднання встановлено. Почніть говорити.'}
            {status === 'error' && 'Помилка підключення'}
            {status === 'idle' && 'Сесія завершена'}
          </span>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="w-full mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{errorMessage}</p>
              <button
                type="button"
                onClick={startLiveSession}
                className="mt-2 px-3 py-1 bg-rose-900/60 hover:bg-rose-800 rounded font-medium text-[11px] text-rose-100"
              >
                Спробувати знову
              </button>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={status === 'connecting' || status === 'idle'}
            onClick={() => setIsMicMuted(!isMicMuted)}
            className={`p-3.5 rounded-full border transition-all ${
              isMicMuted
                ? 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-750'
            }`}
            title={isMicMuted ? 'Увімкнути мікрофон' : 'Вимкнути мікрофон'}
            aria-label={isMicMuted ? 'Увімкнути мікрофон' : 'Вимкнути мікрофон'}
          >
            {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 px-5 py-3 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs shadow-lg shadow-rose-600/30 transition-all active:scale-95"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Завершити розмову</span>
          </button>
        </div>
      </div>
    </div>
  );
};
