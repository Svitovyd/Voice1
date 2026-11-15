/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { AudioVisualizer } from './components/AudioVisualizer';
import { VoiceSettings, EMOTION_PRESETS } from './components/VoiceSettings';
import { AtmosphereControls } from './components/AtmosphereControls';
import { MonologueViewer } from './components/MonologueViewer';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { LiveVoiceModal } from './components/LiveVoiceModal';
import {
  DEFAULT_MONOLOGUE_TEXT,
  parseMonologueLines,
  getVoiceGender,
} from './utils/monologue';

export default function App() {
  const [monologueText, setMonologueText] = useState<string>(DEFAULT_MONOLOGUE_TEXT);
  const [selectedVoice, setSelectedVoice] = useState<string>('Charon');
  const [selectedEmotion, setSelectedEmotion] = useState<string>('bitter_irony');
  const [customStyle, setCustomStyle] = useState<string>(
    EMOTION_PRESETS[0].stylePrompt
  );
  const [atmosphereTheme, setAtmosphereTheme] = useState<'noir' | 'midnight' | 'amber'>('noir');
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);
  const [isLiveModalOpen, setIsLiveModalOpen] = useState<boolean>(false);

  // Parse lines with emotional taxonomy
  const parsedLines = useMemo(() => {
    return parseMonologueLines(monologueText);
  }, [monologueText]);

  // Handle emotion preset change
  const handleSelectEmotion = (emotionId: string) => {
    setSelectedEmotion(emotionId);
    const found = EMOTION_PRESETS.find((e) => e.id === emotionId);
    if (found) {
      setCustomStyle(found.stylePrompt);
    }
  };

  // Sync playback time with line highlight
  const handleTimeUpdate = useCallback(
    (curTime: number, totalDuration: number) => {
      if (totalDuration > 0 && parsedLines.length > 0) {
        const ratio = Math.min(1, Math.max(0, curTime / totalDuration));
        const lineIdx = Math.min(
          parsedLines.length - 1,
          Math.floor(ratio * parsedLines.length)
        );
        setActiveLineIndex(lineIdx);
      } else {
        setActiveLineIndex(null);
      }
    },
    [parsedLines.length]
  );

  const voiceGender = getVoiceGender(selectedVoice);

  // Handle single line audition via browser speech
  const handleSpeakSingleLine = useCallback((lineText: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(lineText);
      utt.lang = 'uk-UA';
      utt.rate = 0.95;
      utt.pitch = voiceGender === 'female' ? 1.15 : 0.85;
      const voices = window.speechSynthesis.getVoices();
      const ukVoice = voices.find((v) => v.lang.includes('uk') || v.lang.includes('UA'));
      if (ukVoice) utt.voice = ukVoice;
      window.speechSynthesis.speak(utt);
    }
  }, [voiceGender]);

  const getThemeBackground = () => {
    switch (atmosphereTheme) {
      case 'amber':
        return 'bg-gradient-to-b from-[#140f0a] via-[#0d0a07] to-[#070503] text-amber-50';
      case 'midnight':
        return 'bg-gradient-to-b from-[#080d1a] via-[#050810] to-[#020408] text-blue-50';
      case 'noir':
      default:
        return 'bg-gradient-to-b from-[#0f0f12] via-[#09090b] to-[#030304] text-zinc-100';
    }
  };

  const getAccentColor = () => {
    switch (atmosphereTheme) {
      case 'amber':
        return '#f59e0b';
      case 'midnight':
        return '#38bdf8';
      case 'noir':
      default:
        return '#f59e0b';
    }
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-700 ${getThemeBackground()}`}>
      {/* Background atmospheric glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-30">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-amber-600/15 blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 rounded-full bg-cyan-600/10 blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 w-96 h-96 rounded-full bg-rose-600/10 blur-3xl" />
      </div>

      <Header
        onOpenLiveVoice={() => setIsLiveModalOpen(true)}
        voiceGender={voiceGender}
      />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        {/* Left column: Monologue viewer and interactive lines */}
        <section className="lg:col-span-7 flex flex-col h-full min-h-[480px]">
          <MonologueViewer
            lines={parsedLines}
            activeLineIndex={activeLineIndex}
            onSelectLine={(idx) => setActiveLineIndex(idx)}
            rawText={monologueText}
            onRawTextChange={setMonologueText}
            onSpeakLine={handleSpeakSingleLine}
          />
        </section>

        {/* Right column: Audio player, Visualizer, Voice & Atmosphere */}
        <section className="lg:col-span-5 flex flex-col gap-5">
          {/* Real-time spectrum visualizer */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
              <span className="font-medium uppercase tracking-wider text-[11px] text-zinc-400">
                Аудіоспектр мовлення
              </span>
              <span className="font-mono text-[11px] text-amber-400">
                {isAudioPlaying ? 'В ефірі' : 'Очікування'}
              </span>
            </div>
            <AudioVisualizer
              isPlaying={isAudioPlaying}
              audioElement={audioElement}
              analyserNode={analyserNode}
              accentColor={getAccentColor()}
            />
          </div>

          {/* Primary Audio Player Bar with Web Audio Effects */}
          <AudioPlayerBar
            monologueText={monologueText}
            selectedVoice={selectedVoice}
            selectedEmotionPrompt={customStyle}
            onAudioElementReady={setAudioElement}
            onAnalyserReady={setAnalyserNode}
            onTimeUpdate={handleTimeUpdate}
            isAudioPlaying={isAudioPlaying}
            setIsAudioPlaying={setIsAudioPlaying}
            onOpenLiveVoice={() => setIsLiveModalOpen(true)}
          />

          {/* Male Voice & Emotion Settings */}
          <VoiceSettings
            selectedVoice={selectedVoice}
            onSelectVoice={setSelectedVoice}
            selectedEmotion={selectedEmotion}
            onSelectEmotion={handleSelectEmotion}
            customStyle={customStyle}
            onCustomStyleChange={setCustomStyle}
            isGenerating={false}
          />

          {/* Atmosphere & Rain Ambience */}
          <AtmosphereControls
            atmosphereTheme={atmosphereTheme}
            onThemeChange={setAtmosphereTheme}
          />
        </section>
      </main>

      <footer className="w-full py-4 text-center text-xs text-zinc-400 border-t border-zinc-850/60 mt-auto relative z-10">
        <p>
          Сповідь «Ігнор вбиває почуття» • Синтез голосу Gemini 3.8 Flash TTS • Живий діалог Gemini 3.8 Live
        </p>
      </footer>

      {/* Live Voice Conversation Modal */}
      <LiveVoiceModal
        isOpen={isLiveModalOpen}
        onClose={() => setIsLiveModalOpen(false)}
        selectedVoice={selectedVoice}
      />
    </div>
  );
}
