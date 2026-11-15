import React, { useState } from 'react';
import { Sparkles, Info, X } from 'lucide-react';

interface HeaderProps {
  onOpenLiveVoice?: () => void;
  voiceGender?: 'male' | 'female';
}

export const Header: React.FC<HeaderProps> = ({ onOpenLiveVoice, voiceGender = 'male' }) => {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <header className="w-full pt-5 pb-3 px-4 sm:px-6 max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-zinc-800/60">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-[11px] font-semibold tracking-widest uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Драматичний монолог
          </span>
          <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            gemini-3.8-flash-tts
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-zinc-100 font-serif break-words">
          Сповідь: «Ігнор вбиває почуття»
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-xl leading-relaxed">
          {voiceGender === 'female' ? 'Жіночий голос' : 'Чоловічий голос'} • Озвучення емоційного монологу про наслідки мовчання, байдужості та повернення власної гідності.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {onOpenLiveVoice && (
          <button
            type="button"
            onClick={onOpenLiveVoice}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-cyan-300 hover:text-cyan-100 bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-500/40 rounded-lg shadow-sm transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Розмова наживо (Live API)</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowInfo(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-300 hover:text-zinc-100 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors"
        >
          <Info className="w-3.5 h-3.5 text-amber-400" />
          <span>Про твір та озвучення</span>
        </button>
      </div>

      {/* Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 text-zinc-200 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowInfo(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-zinc-100 mb-2 font-serif">
              Про монолог та технологію
            </h3>

            <div className="space-y-3 text-xs leading-relaxed text-zinc-300">
              <p>
                Цей монолог — глибока психологічна сповідь про знецінення та ігнорування у стосунках. Він висвітлює внутрішню трансформацію людини від розгубленості й самозвинувачень до точки неповернення та набуття спокою без токсичної прив’язаності.
              </p>
              <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-1.5">
                <div className="font-semibold text-amber-400">Голосова модель Gemini 3.8 Flash TTS:</div>
                <ul className="list-disc pl-4 space-y-1 text-zinc-400">
                  <li>Спеціалізована модель для акторського читання та драматичного дубляжу.</li>
                  <li>Підтримка вокальних видихів, саркастичних смішків та акцентування пауз.</li>
                  <li>Чоловічі тембри: Charon, Fenrir, Puck • Жіночі тембри: Kore, Zephyr.</li>
                </ul>
              </div>
              <p className="text-zinc-400 text-[11px]">
                Фонова атмосфера синтезується наживо через Web Audio API, створюючи ефект запису в дощову ніч при світлі лампи.
              </p>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInfo(false)}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-medium rounded-lg text-xs"
              >
                Зрозуміло
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
