import React from 'react';
import { UserCheck, Sparkles, Sliders, Mic } from 'lucide-react';
import { VoiceGender, getVoiceGender } from '../utils/monologue';

export interface VoiceOption {
  id: string;
  name: string;
  gender: VoiceGender;
  tone: string;
  description: string;
}

export const VOICES: VoiceOption[] = [
  {
    id: 'Charon',
    name: 'Charon (Харон)',
    gender: 'male',
    tone: 'Глибокий сповідальний',
    description: 'Оксамитовий, низький чоловічий голос. Ідеальний для щирої драми та прихованого болю.',
  },
  {
    id: 'Fenrir',
    name: 'Fenrir (Фенрір)',
    gender: 'male',
    tone: 'Суворий та твердий',
    description: 'Стриманий, глибокий та проникливий тембр з твердим чоловічим характером.',
  },
  {
    id: 'Puck',
    name: 'Puck (Пак)',
    gender: 'male',
    tone: 'Іронічний та їдкий',
    description: 'Виразний чоловічий голос з нотками сарказму та легкої гіркоти.',
  },
  {
    id: 'Kore',
    name: 'Kore (Кора)',
    gender: 'female',
    tone: 'Чуттєвий драматичний',
    description: 'Виразний, глибокий та емоційний жіночий голос для проникливої сповіді.',
  },
  {
    id: 'Zephyr',
    name: 'Zephyr (Зефір)',
    gender: 'female',
    tone: 'Ніжний задумливий',
    description: 'М’який, меланхолійний жіночий тембр із відтінком тихого смутку та спокою.',
  },
];

export interface EmotionPreset {
  id: string;
  label: string;
  stylePrompt: string;
  description: string;
}

export const EMOTION_PRESETS: EmotionPreset[] = [
  {
    id: 'bitter_irony',
    label: 'Гірка іронія (Рекомендовано)',
    stylePrompt:
      'Dramatic confession monologue, wounded pride, slow deliberate cadence, cynical chuckled laughter in pauses, heavy bitter irony',
    description: 'Саркастичні посмішки, важкі паузи та холодна констатація правди.',
  },
  {
    id: 'quiet_heartbreak',
    label: 'Приглушений біль',
    stylePrompt:
      'Deep melancholic confession, intimate whispering undertone, emotional pauses, heavy breathing, quiet heartbreak',
    description: 'Близький шепітний голос, відчуття розбитого серця та згасаючої надії.',
  },
  {
    id: 'stoic_detachment',
    label: 'Холодна відстороненість',
    stylePrompt:
      'Calm, cold detached voice, stoic pacing, firm unyielding tone, absolute certainty and final closure',
    description: 'Спокійна, залізна впевненість людини, яка вже пережила найгірше.',
  },
  {
    id: 'climax_passion',
    label: 'Драматичний надрив',
    stylePrompt:
      'Intense dramatic speech, rising emotional tension, powerful resonant delivery, resolute ending',
    description: 'Зростаюча напруга від образливого сміху до рішучого усвідомлення свободи.',
  },
];

interface VoiceSettingsProps {
  selectedVoice: string;
  onSelectVoice: (voiceId: string) => void;
  selectedEmotion: string;
  onSelectEmotion: (emotionId: string) => void;
  customStyle: string;
  onCustomStyleChange: (style: string) => void;
  isGenerating: boolean;
}

export const VoiceSettings: React.FC<VoiceSettingsProps> = ({
  selectedVoice,
  onSelectVoice,
  selectedEmotion,
  onSelectEmotion,
  customStyle,
  onCustomStyleChange,
  isGenerating,
}) => {
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const activeGender = getVoiceGender(selectedVoice);
  const filteredVoices = VOICES.filter((v) => v.gender === activeGender);

  const handleGenderSwitch = (gender: VoiceGender) => {
    if (gender === activeGender || isGenerating) return;
    const firstVoiceOfGender = VOICES.find((v) => v.gender === gender);
    if (firstVoiceOfGender) {
      onSelectVoice(firstVoiceOfGender.id);
    }
  };

  return (
    <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-5 shadow-xl text-zinc-100 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Mic className="w-5 h-5 text-amber-500" />
          <h2 className="text-base font-semibold tracking-wide">
            Налаштування голосу
          </h2>
        </div>

        {/* Gender switch */}
        <div
          className="inline-flex items-center p-0.5 rounded-xl bg-zinc-950/90 border border-zinc-800"
          role="group"
          aria-label="Стать голосу"
        >
          <button
            type="button"
            disabled={isGenerating}
            onClick={() => handleGenderSwitch('male')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeGender === 'male'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Чоловічий</span>
          </button>
          <button
            type="button"
            disabled={isGenerating}
            onClick={() => handleGenderSwitch('female')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeGender === 'female'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Жіночий</span>
          </button>
        </div>
      </div>

      {/* Voice cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5">
        {filteredVoices.map((v) => {
          const isSelected = selectedVoice === v.id;
          const isFemale = v.gender === 'female';
          return (
            <button
              key={v.id}
              type="button"
              disabled={isGenerating}
              onClick={() => onSelectVoice(v.id)}
              className={`p-3 rounded-xl border text-left transition-all relative ${
                isSelected
                  ? isFemale
                    ? 'border-rose-500 bg-rose-500/10 shadow-md shadow-rose-500/5'
                    : 'border-amber-500 bg-amber-500/10 shadow-md shadow-amber-500/5'
                  : 'border-zinc-800/80 bg-zinc-950/40 hover:border-zinc-700 hover:bg-zinc-800/40'
              } ${isGenerating ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-zinc-100 flex items-center gap-1.5">
                  {v.name}
                  {isSelected && (
                    <span
                      className={`w-2 h-2 rounded-full animate-pulse ${
                        isFemale ? 'bg-rose-400' : 'bg-amber-500'
                      }`}
                    />
                  )}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                  {v.id}
                </span>
              </div>
              <p
                className={`text-xs mt-0.5 font-medium ${
                  isFemale ? 'text-rose-300/90' : 'text-amber-400/90'
                }`}
              >
                {v.tone}
              </p>
              <p className="text-[12px] text-zinc-400 mt-1 leading-snug line-clamp-2">
                {v.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Emotion Preset */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-zinc-300 mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Емоційний настрій сповіді
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {EMOTION_PRESETS.map((ep) => {
            const isSelected = selectedEmotion === ep.id;
            return (
              <button
                key={ep.id}
                type="button"
                disabled={isGenerating}
                onClick={() => onSelectEmotion(ep.id)}
                className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                  isSelected
                    ? 'border-amber-500/80 bg-zinc-800 text-amber-200'
                    : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <div className="font-semibold text-zinc-200">{ep.label}</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">{ep.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Advanced Prompt Style */}
      <div className="pt-2 border-t border-zinc-800/70">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors"
        >
          <Sliders className="w-3.5 h-3.5" />
          {showAdvanced ? 'Приховати детальну підказку стилю' : 'Редагувати стиль озвучення (Prompt Style)'}
        </button>

        {showAdvanced && (
          <div className="mt-3 space-y-2">
            <textarea
              value={customStyle}
              onChange={(e) => onCustomStyleChange(e.target.value)}
              disabled={isGenerating}
              rows={2}
              className="w-full text-xs p-2.5 bg-zinc-950 border border-zinc-750 rounded-lg text-zinc-200 focus:outline-none focus:border-amber-500 font-mono"
              placeholder="Стильовий опис для Gemini 3.8 Flash TTS..."
            />
            <p className="text-[11px] text-zinc-400">
              Модель Gemini 3.8 Flash TTS розуміє природний опис манери мовлення, тембру, дихання та пауз.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
