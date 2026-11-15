import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Download,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Waves,
  Sliders,
  ChevronDown,
  ChevronUp,
  Volume1,
  Music,
} from 'lucide-react';
import { prepareTtsPrompt, getVoiceGender } from '../utils/monologue';
import {
  EFFECT_PRESETS,
  EffectPreset,
  sanitizeFeedback,
  clamp,
  calculateBalancedGains,
} from '../utils/audioEffects';
import { createSpokenMonologueWavUrl } from '../utils/defaultAudio';

interface AudioPlayerBarProps {
  monologueText: string;
  selectedVoice: string;
  selectedEmotionPrompt: string;
  onAudioElementReady: (el: HTMLAudioElement | null) => void;
  onAnalyserReady?: (analyser: AnalyserNode | null) => void;
  onTimeUpdate: (currentTime: number, duration: number) => void;
  isAudioPlaying: boolean;
  setIsAudioPlaying: (playing: boolean) => void;
  onOpenLiveVoice?: () => void;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  monologueText,
  selectedVoice,
  selectedEmotionPrompt,
  onAudioElementReady,
  onAnalyserReady,
  onTimeUpdate,
  isAudioPlaying,
  setIsAudioPlaying,
  onOpenLiveVoice,
}) => {
  // Preload initial spoken audio so the player has a live audio source with Web Audio graph immediately
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [usedModel, setUsedModel] = useState<string>('gemini-3.8-flash-tts');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isQuotaWarning, setIsQuotaWarning] = useState<boolean>(false);
  const [generationSuccess, setGenerationSuccess] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [volume, setVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // --- Web Audio Effects State ---
  const [activePresetId, setActivePresetId] = useState<string>('dramatic_noir');
  const [echoEnabled, setEchoEnabled] = useState<boolean>(true);
  const [echoMix, setEchoMix] = useState<number>(0.45);
  const [delayTime, setDelayTime] = useState<number>(0.34);
  const [feedback, setFeedback] = useState<number>(0.48);

  const [reverbEnabled, setReverbEnabled] = useState<boolean>(true);
  const [reverbMix, setReverbMix] = useState<number>(0.55);
  const [reverbSpace, setReverbSpace] = useState<'cathedral' | 'hall' | 'room'>('hall');
  const [showEffectsPanel, setShowEffectsPanel] = useState<boolean>(true);
  const [isTestingEffect, setIsTestingEffect] = useState<boolean>(false);

  // --- Web Audio Node References ---
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const wetDelayGainRef = useRef<GainNode | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const delayFeedbackRef = useRef<GainNode | null>(null);
  const delayFilterRef = useRef<BiquadFilterNode | null>(null);
  const wetReverbGainRef = useRef<GainNode | null>(null);
  const convolverRef = useRef<ConvolverNode | null>(null);
  const reverbFilterRef = useRef<BiquadFilterNode | null>(null);
  const masterEffectsGainRef = useRef<GainNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);

  // Initialize initial default audio on mount
  useEffect(() => {
    try {
      const initialUrl = createSpokenMonologueWavUrl();
      setAudioUrl(initialUrl);
    } catch (e) {
      console.warn('Initial audio preparation:', e);
    }
  }, []);

  // Helper: Generates realistic impulse response for reverb with early reflections and warm decay
  const generateImpulseResponse = useCallback(
    (ctx: AudioContext, roomDuration: number, decayRate: number) => {
      const sampleRate = ctx.sampleRate;
      const length = Math.floor(sampleRate * roomDuration);
      const impulse = ctx.createBuffer(2, length, sampleRate);
      const left = impulse.getChannelData(0);
      const right = impulse.getChannelData(1);

      // Early reflection taps for acoustic depth
      const earlyReflections = [
        { time: 0.02, gain: 0.6 },
        { time: 0.045, gain: 0.45 },
        { time: 0.08, gain: 0.3 },
      ];

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const normT = i / length;
        // Warm exponential decay: high frequencies absorb faster
        const decay = Math.exp(-t * decayRate) * (1 - 0.4 * normT);

        let leftSample = (Math.random() * 2 - 1) * decay;
        let rightSample = (Math.random() * 2 - 1) * decay;

        for (const er of earlyReflections) {
          const sampleIndex = Math.floor(er.time * sampleRate);
          if (Math.abs(i - sampleIndex) < 4) {
            leftSample += er.gain * (Math.random() * 0.5 + 0.5);
            rightSample += er.gain * (Math.random() * 0.5 + 0.5);
          }
        }

        left[i] = leftSample;
        right[i] = rightSample;
      }
      return impulse;
    },
    []
  );

  // Initialize Web Audio Graph routing exclusively on audioRef
  const setupWebAudioGraph = useCallback(() => {
    if (!audioRef.current) return;

    try {
      let ctx = audioCtxRef.current;
      if (!ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;

        ctx = new AudioCtx();
        audioCtxRef.current = ctx;

        // Source from HTML audio element
        audioRef.current.crossOrigin = 'anonymous';
        const source = ctx.createMediaElementSource(audioRef.current);
        sourceNodeRef.current = source;

        // 1. Dry Gain Path
        const dryGain = ctx.createGain();
        dryGainRef.current = dryGain;
        source.connect(dryGain);

        // Master Output Bus
        const masterOut = ctx.createGain();
        masterOut.gain.setValueAtTime(1.0, ctx.currentTime);
        masterEffectsGainRef.current = masterOut;

        // Analyser for visualizer
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.8;
        analyserNodeRef.current = analyser;
        onAnalyserReady?.(analyser);

        dryGain.connect(masterOut);

        // 2. Delay / Echo Path (warm lowpass tape echo)
        const delay = ctx.createDelay(2.0);
        delay.delayTime.setValueAtTime(delayTime, ctx.currentTime);
        delayNodeRef.current = delay;

        const fbGain = ctx.createGain();
        fbGain.gain.setValueAtTime(echoEnabled ? sanitizeFeedback(feedback) : 0, ctx.currentTime);
        delayFeedbackRef.current = fbGain;

        const delayFilter = ctx.createBiquadFilter();
        delayFilter.type = 'lowpass';
        delayFilter.frequency.setValueAtTime(2800, ctx.currentTime);
        delayFilterRef.current = delayFilter;

        const wetDelayGain = ctx.createGain();
        wetDelayGainRef.current = wetDelayGain;

        // Echo feedback loop
        source.connect(delay);
        delay.connect(delayFilter);
        delayFilter.connect(fbGain);
        fbGain.connect(delay);
        delayFilter.connect(wetDelayGain);
        wetDelayGain.connect(masterOut);

        // 3. Reverb Path (convolution reverb)
        const convolver = ctx.createConvolver();
        const durationSec = reverbSpace === 'cathedral' ? 4.0 : reverbSpace === 'hall' ? 2.6 : 1.5;
        const decayAmount = reverbSpace === 'cathedral' ? 1.6 : reverbSpace === 'hall' ? 2.0 : 2.8;
        convolver.buffer = generateImpulseResponse(ctx, durationSec, decayAmount);
        convolverRef.current = convolver;

        const reverbFilter = ctx.createBiquadFilter();
        reverbFilter.type = 'lowpass';
        reverbFilter.frequency.setValueAtTime(3600, ctx.currentTime);
        reverbFilterRef.current = reverbFilter;

        const wetReverbGain = ctx.createGain();
        wetReverbGainRef.current = wetReverbGain;

        source.connect(convolver);
        convolver.connect(reverbFilter);
        reverbFilter.connect(wetReverbGain);
        wetReverbGain.connect(masterOut);

        // Connect master out to analyser and speakers
        masterOut.connect(analyser);
        analyser.connect(ctx.destination);
      }

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Apply balanced gains
      const { dryGain: dG, echoGain: eG, reverbGain: rG } = calculateBalancedGains(
        echoEnabled,
        echoMix,
        reverbEnabled,
        reverbMix
      );
      if (dryGainRef.current) dryGainRef.current.gain.setValueAtTime(dG, ctx.currentTime);
      if (wetDelayGainRef.current) wetDelayGainRef.current.gain.setValueAtTime(eG, ctx.currentTime);
      if (wetReverbGainRef.current) wetReverbGainRef.current.gain.setValueAtTime(rG, ctx.currentTime);
    } catch (e) {
      console.warn('Web Audio Graph initialization note:', e);
    }
  }, [
    delayTime,
    echoEnabled,
    echoMix,
    feedback,
    generateImpulseResponse,
    onAnalyserReady,
    reverbEnabled,
    reverbMix,
    reverbSpace,
  ]);

  // Synchronize dynamic effect parameter adjustments in real time
  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const { dryGain, echoGain, reverbGain } = calculateBalancedGains(
      echoEnabled,
      echoMix,
      reverbEnabled,
      reverbMix
    );

    if (dryGainRef.current) {
      dryGainRef.current.gain.setTargetAtTime(dryGain, ctx.currentTime, 0.05);
    }
    if (wetDelayGainRef.current) {
      wetDelayGainRef.current.gain.setTargetAtTime(echoGain, ctx.currentTime, 0.05);
    }
    if (delayFeedbackRef.current) {
      delayFeedbackRef.current.gain.setTargetAtTime(
        echoEnabled ? sanitizeFeedback(feedback) : 0,
        ctx.currentTime,
        0.05
      );
    }
    if (delayNodeRef.current) {
      delayNodeRef.current.delayTime.setTargetAtTime(
        clamp(delayTime, 0.05, 1.2),
        ctx.currentTime,
        0.05
      );
    }
    if (wetReverbGainRef.current) {
      wetReverbGainRef.current.gain.setTargetAtTime(reverbGain, ctx.currentTime, 0.05);
    }
  }, [echoEnabled, echoMix, delayTime, feedback, reverbEnabled, reverbMix]);

  // Re-generate reverb impulse when space is changed
  const updateReverbSpace = (space: 'cathedral' | 'hall' | 'room') => {
    setReverbSpace(space);
    const ctx = audioCtxRef.current;
    if (ctx && convolverRef.current) {
      const dur = space === 'cathedral' ? 4.0 : space === 'hall' ? 2.6 : 1.5;
      const dec = space === 'cathedral' ? 1.6 : space === 'hall' ? 2.0 : 2.8;
      convolverRef.current.buffer = generateImpulseResponse(ctx, dur, dec);
    }
  };

  // Expose audio element for visualizer
  useEffect(() => {
    onAudioElementReady(audioRef.current);
  }, [audioUrl, onAudioElementReady]);

  // Play an instant test phrase through the active Web Audio graph so the user immediately hears the effects
  const playEffectSoundTest = () => {
    setupWebAudioGraph();
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    setIsTestingEffect(true);

    try {
      // Play a short vocal acoustic chord burst through the effects bus
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(146.83, now); // D3
      osc.frequency.exponentialRampToValueAtTime(110.0, now + 0.3);

      oscGain.gain.setValueAtTime(0.3, now);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      if (delayNodeRef.current && dryGainRef.current && convolverRef.current) {
        osc.connect(dryGainRef.current);
        osc.connect(delayNodeRef.current);
        osc.connect(convolverRef.current);
      } else {
        osc.connect(ctx.destination);
      }

      osc.start(now);
      osc.stop(now + 0.4);

      setTimeout(() => {
        setIsTestingEffect(false);
      }, 1200);
    } catch {
      setIsTestingEffect(false);
    }
  };

  // Handle Preset application
  const applyPreset = (preset: EffectPreset) => {
    setActivePresetId(preset.id);
    setEchoEnabled(preset.echoEnabled);
    setEchoMix(preset.echoMix);
    setDelayTime(preset.delayTime);
    setFeedback(preset.feedback);
    setReverbEnabled(preset.reverbEnabled);
    setReverbMix(preset.reverbMix);

    if (preset.reverbDuration > 3.0) {
      updateReverbSpace('cathedral');
    } else if (preset.reverbDuration > 2.0) {
      updateReverbSpace('hall');
    } else {
      updateReverbSpace('room');
    }
  };

  // Handle TTS Generation with Gemini 3.8 Flash TTS
  const handleGenerateTts = async () => {
    setIsGenerating(true);
    setGenerationError(null);
    setIsQuotaWarning(false);
    setGenerationSuccess(false);

    try {
      const { speechText, stylePrompt } = prepareTtsPrompt(
        monologueText,
        selectedEmotionPrompt,
        getVoiceGender(selectedVoice)
      );

      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: speechText,
          voiceName: selectedVoice,
          style: stylePrompt,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (response.status === 429 || data.isQuotaError) {
          setIsQuotaWarning(true);
          setGenerationError(
            data.error ||
              'Вичерпано денний ліміт безкоштовного тарифу Gemini TTS. Використовується вбудований трек із повною підтримкою ефектів.'
          );
          return;
        }
        throw new Error(data.error || 'Не вдалося згенерувати аудіо.');
      }

      if (data.model) {
        setUsedModel(data.model);
      }

      // Convert base64 WAV to Blob URL for clean browser playback
      const byteCharacters = atob(data.audioBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/wav' });
      const newUrl = URL.createObjectURL(blob);

      if (audioUrl && !audioUrl.startsWith('data:')) {
        URL.revokeObjectURL(audioUrl);
      }

      setAudioUrl(newUrl);
      setGenerationSuccess(true);
      setTimeout(() => setGenerationSuccess(false), 4000);

      // Auto play once ready
      if (audioRef.current) {
        audioRef.current.src = newUrl;
        audioRef.current.load();
        audioRef.current.playbackRate = playbackRate;

        // Ensure graph is initialized
        setupWebAudioGraph();

        audioRef.current
          .play()
          .then(() => {
            setIsAudioPlaying(true);
          })
          .catch(() => {
            // User interaction needed
          });
      }
    } catch (err: any) {
      setGenerationError(err.message || 'Помилка підключення до Gemini API.');
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePlayPause = () => {
    setupWebAudioGraph();

    if (audioRef.current) {
      if (isAudioPlaying) {
        audioRef.current.pause();
        setIsAudioPlaying(false);
      } else {
        if (!audioRef.current.src && audioUrl) {
          audioRef.current.src = audioUrl;
        }
        audioRef.current
          .play()
          .then(() => {
            setIsAudioPlaying(true);
          })
          .catch((e) => console.warn(e));
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    setCurrentTime(targetTime);
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
    }
    onTimeUpdate(targetTime, duration);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const cur = audioRef.current.currentTime;
      const dur = audioRef.current.duration || 0;
      setCurrentTime(cur);
      setDuration(dur);
      onTimeUpdate(cur, dur);
    }
  };

  const handleAudioEnded = () => {
    setIsAudioPlaying(false);
    setCurrentTime(0);
    onTimeUpdate(0, duration);
  };

  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      const nextMuted = !isMuted;
      setIsMuted(nextMuted);
      audioRef.current.muted = nextMuted;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (audioRef.current) {
      audioRef.current.volume = val;
      audioRef.current.muted = val === 0;
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="bg-zinc-900/95 border border-zinc-800/90 rounded-2xl p-5 shadow-2xl backdrop-blur-md text-zinc-100 space-y-4">
      {/* Hidden native audio tag with crossOrigin */}
      <audio
        ref={audioRef}
        src={audioUrl || undefined}
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={handleAudioEnded}
      />

      {/* Top action row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-xs uppercase tracking-wider font-semibold text-zinc-300">
            Озвучення: Gemini 3.8 Flash TTS
          </span>
          {audioUrl && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              WAV Аудіо Активне
            </span>
          )}
        </div>

        {/* Primary Action Button */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {onOpenLiveVoice && (
            <button
              type="button"
              onClick={onOpenLiveVoice}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-500/40 shadow-sm transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Живий діалог (Live API)</span>
            </button>
          )}

          <button
            type="button"
            disabled={isGenerating}
            onClick={handleGenerateTts}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Генерація...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Озвучити Gemini</span>
              </>
            )}
          </button>

          {audioUrl && (
            <a
              href={audioUrl}
              download="spovid-monolog-gemini.wav"
              className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-zinc-100 border border-zinc-700 transition-all"
              title="Завантажити запис у форматі .WAV"
            >
              <Download className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* Error / Quota Alert banner */}
      {generationError && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-2 ${
            isQuotaWarning
              ? 'bg-amber-950/40 border-amber-700/60 text-amber-200'
              : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
          }`}
        >
          <div className="flex items-start gap-2">
            <AlertCircle
              className={`w-4 h-4 mt-0.5 shrink-0 ${
                isQuotaWarning ? 'text-amber-400' : 'text-rose-400'
              }`}
            />
            <div>
              <p className="font-semibold">{generationError}</p>
              <p
                className={`text-[11px] mt-0.5 ${
                  isQuotaWarning ? 'text-amber-300/80' : 'text-rose-400/80'
                }`}
              >
                {isQuotaWarning
                  ? 'Аудіоплеєр та всі Web Audio ефекти (ехо, реверб, спектр) повністю працюють на вбудованому аудіотреку.'
                  : 'Ви можете слухати аудіо та налаштовувати ефекти в реальному часі.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {generationSuccess && (
        <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Сповідь успішно озвучена моделлю {usedModel}!</span>
        </div>
      )}

      {/* Scrubber / Progress timeline */}
      <div>
        <div className="flex items-center justify-between text-xs font-mono text-zinc-400 mb-1.5">
          <span>{formatTime(currentTime)}</span>
          <span className="text-[11px] text-zinc-400">
            {duration > 0 ? formatTime(duration) : '0:28'}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max={duration || 28}
          step="0.1"
          value={currentTime}
          onChange={handleSeek}
          aria-label="Перемотка аудіо"
          className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
        />
      </div>

      {/* Primary Playback controls row */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-1 border-b border-zinc-800/70 pb-4">
        {/* Playback buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlayPause}
            className="w-12 h-12 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 flex items-center justify-center shadow-md shadow-amber-500/20 transition-all transform active:scale-95"
            aria-label={isAudioPlaying ? 'Пауза' : 'Відтворити'}
          >
            {isAudioPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current translate-x-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setupWebAudioGraph();
              if (audioRef.current) {
                audioRef.current.currentTime = 0;
                setCurrentTime(0);
                if (!isAudioPlaying) {
                  audioRef.current.play().then(() => setIsAudioPlaying(true));
                }
              }
            }}
            className="p-2.5 rounded-full bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-zinc-100 transition-all"
            title="Почати з початку"
            aria-label="Почати з початку"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Speed switcher */}
          <div className="flex items-center bg-zinc-950/80 rounded-lg p-0.5 border border-zinc-800">
            {[0.8, 1.0, 1.2].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => handlePlaybackRateChange(rate)}
                className={`px-2 py-1 text-xs font-mono rounded-md transition-all ${
                  playbackRate === rate
                    ? 'bg-amber-500/20 text-amber-300 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>

        {/* Volume & Audition test sound */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={playEffectSoundTest}
            disabled={isTestingEffect}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-750 text-amber-300 border border-amber-500/30 transition-all active:scale-95"
            title="Зіграти звуковий тестовий імпульс крізь активні ефекти реверберації та відлуння"
          >
            <Music className={`w-3.5 h-3.5 ${isTestingEffect ? 'animate-spin text-amber-400' : ''}`} />
            <span>{isTestingEffect ? 'Звучить тест...' : 'Тест ефектів'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className="text-zinc-400 hover:text-zinc-200 transition-colors"
              aria-label={isMuted ? 'Увімкнути звук' : 'Вимкнути звук'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              aria-label="Гучність аудіо"
              className="w-20 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>
        </div>
      </div>

      {/* --- Web Audio Effects Section (Reverb & Echo / Delay) --- */}
      <div className="pt-1">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Waves className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
              Драматичні ефекти голосу
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 normal-case">
                Web Audio DSP
              </span>
            </h3>
          </div>

          <button
            type="button"
            onClick={() => setShowEffectsPanel(!showEffectsPanel)}
            className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-zinc-800/60 transition-colors"
          >
            <Sliders className="w-3 h-3 text-amber-400" />
            <span>{showEffectsPanel ? 'Згорнути' : 'Налаштувати ехо/реверб'}</span>
            {showEffectsPanel ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Quick Effect Presets Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-3">
          {EFFECT_PRESETS.map((preset) => {
            const isSelected = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`px-2.5 py-1.5 rounded-lg text-left text-xs transition-all border ${
                  isSelected
                    ? 'border-cyan-500/70 bg-cyan-950/40 text-cyan-200 shadow-sm shadow-cyan-500/10 font-medium'
                    : 'border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
              >
                <div className="truncate font-semibold text-[11px]">{preset.name}</div>
                <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                  {preset.echoEnabled && preset.reverbEnabled
                    ? 'Ехо + Реверб'
                    : preset.reverbEnabled
                    ? 'Тільки реверб'
                    : preset.echoEnabled
                    ? 'Тільки ехо'
                    : 'Без ефектів'}
                </div>
              </button>
            );
          })}
        </div>

        {/* Detailed Controls Panel */}
        {showEffectsPanel && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 animate-in fade-in duration-200">
            {/* 1. Echo / Delay Card */}
            <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-zinc-200">Відлуння (Echo / Delay)</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setupWebAudioGraph();
                    setEchoEnabled(!echoEnabled);
                    setActivePresetId('custom');
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    echoEnabled
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {echoEnabled ? 'Увімкнено' : 'Вимкнено'}
                </button>
              </div>

              {/* Echo Mix */}
              <div>
                <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                  <span>Рівень відлуння (Mix)</span>
                  <span className="font-mono text-amber-300 font-semibold">
                    {Math.round(echoMix * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.85"
                  step="0.02"
                  disabled={!echoEnabled}
                  value={echoMix}
                  onChange={(e) => {
                    setupWebAudioGraph();
                    setEchoMix(parseFloat(e.target.value));
                    setActivePresetId('custom');
                  }}
                  aria-label="Рівень ехо"
                  className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500 disabled:opacity-40"
                />
              </div>

              {/* Delay Time */}
              <div>
                <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                  <span>Інтервал затримки</span>
                  <span className="font-mono text-zinc-300">{Math.round(delayTime * 1000)} мс</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.8"
                  step="0.02"
                  disabled={!echoEnabled}
                  value={delayTime}
                  onChange={(e) => {
                    setupWebAudioGraph();
                    setDelayTime(parseFloat(e.target.value));
                    setActivePresetId('custom');
                  }}
                  aria-label="Інтервал затримки ехо"
                  className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500 disabled:opacity-40"
                />
              </div>

              {/* Feedback */}
              <div>
                <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                  <span>Кількість повторів (Feedback)</span>
                  <span className="font-mono text-zinc-300">{Math.round(feedback * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.75"
                  step="0.02"
                  disabled={!echoEnabled}
                  value={feedback}
                  onChange={(e) => {
                    setupWebAudioGraph();
                    setFeedback(parseFloat(e.target.value));
                    setActivePresetId('custom');
                  }}
                  aria-label="Кількість повторів"
                  className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500 disabled:opacity-40"
                />
              </div>
            </div>

            {/* 2. Reverb Card */}
            <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-zinc-200">Реверберація (Reverb)</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setupWebAudioGraph();
                    setReverbEnabled(!reverbEnabled);
                    setActivePresetId('custom');
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    reverbEnabled
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {reverbEnabled ? 'Увімкнено' : 'Вимкнено'}
                </button>
              </div>

              {/* Reverb Space Type */}
              <div>
                <span className="block text-[11px] text-zinc-400 mb-1.5">Акустика простору</span>
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      { id: 'room', label: 'Кімната', sec: '1.5s' },
                      { id: 'hall', label: 'Зала', sec: '2.6s' },
                      { id: 'cathedral', label: 'Собор', sec: '4.0s' },
                    ] as const
                  ).map((space) => (
                    <button
                      key={space.id}
                      type="button"
                      disabled={!reverbEnabled}
                      onClick={() => {
                        setupWebAudioGraph();
                        updateReverbSpace(space.id);
                        setActivePresetId('custom');
                      }}
                      className={`px-2 py-1 text-[11px] rounded transition-all border ${
                        reverbSpace === space.id && reverbEnabled
                          ? 'border-cyan-500 bg-cyan-950/60 text-cyan-200 font-medium'
                          : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-zinc-200'
                      } disabled:opacity-40`}
                    >
                      <div className="leading-tight">{space.label}</div>
                      <div className="text-[9px] text-zinc-400 font-mono">{space.sec}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Reverb Wet Mix */}
              <div>
                <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                  <span>Глибина простору (Mix)</span>
                  <span className="font-mono text-cyan-300 font-semibold">
                    {Math.round(reverbMix * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.85"
                  step="0.02"
                  disabled={!reverbEnabled}
                  value={reverbMix}
                  onChange={(e) => {
                    setupWebAudioGraph();
                    setReverbMix(parseFloat(e.target.value));
                    setActivePresetId('custom');
                  }}
                  aria-label="Глибина реверберації"
                  className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-cyan-400 disabled:opacity-40"
                />
              </div>

              <p className="text-[10px] text-zinc-400 italic pt-1 leading-snug">
                Створює відчуття глибокої луни в порожньому просторі, наповнюючи паузи драматичним таненням звуку.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
