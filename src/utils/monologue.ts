/**
 * Utility functions for Monologue parsing, speech formatting,
 * and emotional phrasing for Gemini TTS (male and female voices).
 */

export type VoiceGender = 'male' | 'female';

export interface MonologueLine {
  id: string;
  text: string;
  emotion: 'intro' | 'irony' | 'sorrow' | 'turning_point' | 'climax';
  note?: string;
}

export const DEFAULT_MONOLOGUE_TEXT = `..Запамятай раз і назавжди...
Ігнор вбиває почуття.
Ххе-хе...
Думаєш, твоє мовчання змусить людину бігати за тобою?
Хохо...
Яка самовпевненість. Хех...
Спочатку він буде чекати.
Скучати.
Шукати тобі виправдання.
Ха... Навіть звинувачувати себе за те,
в чому не винний.
А потім...
Знаєш що відбудеться?
Він привикне до твоєї відсутності.
Чуєш?
Привикне.
Ххех... І ось тоді почнеться саме цікаве.
Ти раптом захочеш повернути його увагу...
Але буде пізно.
Тому що людина, яку надто довго заставляли почуватися непотрібним.
Одного разу зрозуміє...
Що прекрасно може жити і без тебе.`;

export function getVoiceGender(voiceId: string): VoiceGender {
  if (voiceId === 'Kore' || voiceId === 'Zephyr') {
    return 'female';
  }
  return 'male';
}

export function parseMonologueLines(raw: string): MonologueLine[] {
  const rawLines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return rawLines.map((line, idx) => {
    let emotion: MonologueLine['emotion'] = 'sorrow';
    let note: string | undefined;

    if (line.includes('Запамятай') || line.includes('Ігнор')) {
      emotion = 'intro';
      note = 'Попередження';
    } else if (line.match(/Ххе|Хохо|Хех|Ха|самовпевненість|бігати/i)) {
      emotion = 'irony';
      note = 'Гіркий сарказм';
    } else if (line.includes('чекати') || line.includes('Скучати') || line.includes('виправдання') || line.includes('звинувачувати')) {
      emotion = 'sorrow';
      note = 'Біль і розгубленість';
    } else if (line.includes('привикне') || line.includes('відсутності') || line.includes('Чуєш')) {
      emotion = 'turning_point';
      note = 'Точка неповернення';
    } else if (line.includes('пізно') || line.includes('непотрібним') || line.includes('непотрібною') || line.includes('без тебе') || line.includes('цікаве')) {
      emotion = 'climax';
      note = 'Катарсис';
    }

    return {
      id: `line-${idx}`,
      text: line,
      emotion,
      note,
    };
  });
}

/**
 * Optimizes text for speech synthesis with vocal bursts and pauses,
 * adapting the vocal timbre instruction to male or female delivery.
 */
export function prepareTtsPrompt(
  text: string,
  voiceStyle: string,
  gender: VoiceGender = 'male'
): { speechText: string; stylePrompt: string } {
  // Polish laughs and vocal pauses for natural Gemini TTS interpretation
  const speechText = text
    .replace(/Ххе-хе\.\.\./g, 'Хе-хе... <laugh>')
    .replace(/Хохо\.\.\./g, 'Ха-ха... <laugh>')
    .replace(/Хех\.\.\./g, 'Хех... <breath>')
    .replace(/Ххех\.\.\./g, 'Хех... <breath>');

  const timbreDesc =
    gender === 'female'
      ? 'expressive female timbre, emotional Ukrainian woman voice'
      : 'deep male timbre, emotional Ukrainian man voice';

  const stylePrompt = `${voiceStyle}. Ukrainian language, ${timbreDesc}, thoughtful pauses on ellipses, melancholic atmosphere, authentic sighs and emotional weight.`;

  return { speechText, stylePrompt };
}

/**
 * Estimates reading duration in seconds for progress bar or fallback timing.
 */
export function estimateAudioDuration(text: string, wordsPerMinute: number = 100): number {
  const words = text.trim().split(/\s+/).length;
  // Account for pauses at ellipses and commas
  const ellipsesCount = (text.match(/\.\.\./g) || []).length;
  const commasCount = (text.match(/[,?!]/g) || []).length;
  const baseSeconds = (words / wordsPerMinute) * 60;
  const extraPauseSeconds = ellipsesCount * 1.2 + commasCount * 0.3;
  return Math.max(5, Math.round(baseSeconds + extraPauseSeconds));
}
