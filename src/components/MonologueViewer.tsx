import React, { useState } from 'react';
import { Copy, Check, Edit3, RotateCcw, Volume2, Sparkles, BookOpen } from 'lucide-react';
import { MonologueLine, DEFAULT_MONOLOGUE_TEXT } from '../utils/monologue';

interface MonologueViewerProps {
  lines: MonologueLine[];
  activeLineIndex: number | null;
  onSelectLine: (index: number) => void;
  rawText: string;
  onRawTextChange: (newText: string) => void;
  onSpeakLine?: (lineText: string) => void;
}

export const MonologueViewer: React.FC<MonologueViewerProps> = ({
  lines,
  activeLineIndex,
  onSelectLine,
  rawText,
  onRawTextChange,
  onSpeakLine,
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleReset = () => {
    onRawTextChange(DEFAULT_MONOLOGUE_TEXT);
    setIsEditing(false);
  };

  const getEmotionBadge = (emotion: MonologueLine['emotion'], note?: string) => {
    switch (emotion) {
      case 'intro':
        return (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
            {note || 'Вступ'}
          </span>
        );
      case 'irony':
        return (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
            {note || 'Іронія'}
          </span>
        );
      case 'sorrow':
        return (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
            {note || 'Біль'}
          </span>
        );
      case 'turning_point':
        return (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            {note || 'Злам'}
          </span>
        );
      case 'climax':
        return (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            {note || 'Фінал'}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-5 shadow-2xl backdrop-blur-md text-zinc-100 flex flex-col h-full">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-zinc-800/80 mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 sm:w-5 h-4 sm:h-5 text-amber-500" />
          <h2 className="text-sm sm:text-base font-semibold tracking-wide text-zinc-100">
            Текст сповіді
          </h2>
          <span className="text-[11px] sm:text-xs text-zinc-400">
            ({lines.length} рядків)
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className={`px-2 sm:px-2.5 py-1 text-xs rounded-lg flex items-center gap-1 sm:gap-1.5 transition-all ${
              isEditing
                ? 'bg-amber-500 text-zinc-950 font-medium'
                : 'bg-zinc-800 hover:bg-zinc-750 text-zinc-300'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isEditing ? 'Перегляд' : 'Редагувати'}</span>
          </button>

          {rawText !== DEFAULT_MONOLOGUE_TEXT && (
            <button
              type="button"
              onClick={handleReset}
              title="Відновити оригінальний текст"
              className="p-1.5 text-xs rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-400 hover:text-zinc-200 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="px-2 sm:px-2.5 py-1 text-xs rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-300 flex items-center gap-1 sm:gap-1.5 transition-all"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Скопійовано</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                <span>Копіювати</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content Area */}
      {isEditing ? (
        <div className="flex-1 flex flex-col">
          <label className="text-xs text-zinc-400 mb-2">
            Ви можете змінити текст монологу або додати свої рядки:
          </label>
          <textarea
            value={rawText}
            onChange={(e) => onRawTextChange(e.target.value)}
            rows={16}
            className="w-full flex-1 p-3.5 text-sm font-serif leading-relaxed bg-zinc-950/90 border border-zinc-700/80 rounded-xl text-zinc-200 focus:outline-none focus:border-amber-500 shadow-inner resize-none font-sans"
            placeholder="Введіть або відредагуйте текст монологу..."
          />
          <div className="flex justify-between items-center mt-3 text-xs text-zinc-400">
            <span>Збережеться автоматично для наступної генерації TTS</span>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-medium rounded-lg"
            >
              Завершити редагування
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-1 space-y-2 max-h-[520px] scrollbar-thin scrollbar-thumb-zinc-700">
          {lines.map((line, idx) => {
            const isActive = activeLineIndex === idx;
            const isChuckle = /Ххе|Хохо|Хех|Ха/i.test(line.text);

            return (
              <div
                key={line.id}
                onClick={() => onSelectLine(idx)}
                className={`group flex items-start justify-between gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                  isActive
                    ? 'bg-amber-500/15 border border-amber-500/40 shadow-md shadow-amber-500/5 translate-x-1'
                    : 'bg-zinc-950/40 border border-zinc-850 hover:border-zinc-750 hover:bg-zinc-800/40'
                }`}
              >
                <div className="flex items-start gap-3 flex-1">
                  <span className="text-xs font-mono text-zinc-500 w-5 text-right select-none pt-0.5">
                    {idx + 1}
                  </span>

                  <div className="flex-1">
                    <p
                      className={`text-sm sm:text-base leading-relaxed tracking-wide transition-colors ${
                        isActive
                          ? 'text-amber-200 font-medium'
                          : isChuckle
                          ? 'text-amber-300/80 italic font-medium'
                          : 'text-zinc-200'
                      }`}
                    >
                      {line.text}
                    </p>

                    {isChuckle && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-400/70 mt-1 font-mono">
                        <Sparkles className="w-3 h-3" />
                        (вокальний видих / смішок)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start pt-0.5">
                  {getEmotionBadge(line.emotion, line.note)}

                  {onSpeakLine && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSpeakLine(line.text);
                      }}
                      title="Озвучити тільки цей рядок"
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 rounded transition-all"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
