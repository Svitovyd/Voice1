/**
 * Audio effects configuration and helper functions for Web Audio API
 * reverb, echo/delay, and PCM audio conversion.
 */

export interface EffectPreset {
  id: string;
  name: string;
  description: string;
  echoEnabled: boolean;
  echoMix: number; // 0 to 1
  delayTime: number; // in seconds (0.05 to 1.0)
  feedback: number; // 0 to 0.8
  reverbEnabled: boolean;
  reverbMix: number; // 0 to 1
  reverbDuration: number; // in seconds
  reverbDecay: number;
}

export const EFFECT_PRESETS: EffectPreset[] = [
  {
    id: 'dry',
    name: 'Чистий голос',
    description: 'Без просторових ефектів, чисте студійне звучання',
    echoEnabled: false,
    echoMix: 0,
    delayTime: 0.3,
    feedback: 0.3,
    reverbEnabled: false,
    reverbMix: 0,
    reverbDuration: 1.5,
    reverbDecay: 2.0,
  },
  {
    id: 'dramatic_noir',
    name: 'Драматичний нуар (Рекомендовано)',
    description: 'Оксамитовий відголос та кінематографічна реверберація зали',
    echoEnabled: true,
    echoMix: 0.45,
    delayTime: 0.34,
    feedback: 0.48,
    reverbEnabled: true,
    reverbMix: 0.55,
    reverbDuration: 2.6,
    reverbDecay: 2.0,
  },
  {
    id: 'void_confession',
    name: 'Голос у порожнечі',
    description: 'Глибокий соборний простір з довгим танучим шлейфом',
    echoEnabled: false,
    echoMix: 0,
    delayTime: 0.4,
    feedback: 0.4,
    reverbEnabled: true,
    reverbMix: 0.75,
    reverbDuration: 4.0,
    reverbDecay: 1.6,
  },
  {
    id: 'ghostly_echo',
    name: 'Примарне відлуння',
    description: 'Виразні таємничі повтори з теплим фільтруванням частот',
    echoEnabled: true,
    echoMix: 0.65,
    delayTime: 0.42,
    feedback: 0.60,
    reverbEnabled: true,
    reverbMix: 0.35,
    reverbDuration: 2.2,
    reverbDecay: 2.4,
  },
];

export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/**
 * Calculates safe feedback level to prevent runaway howling.
 */
export function sanitizeFeedback(feedback: number): number {
  return clamp(feedback, 0.05, 0.75);
}

/**
 * Computes balanced dry, echo, and reverb gains so wet signals are vividly audible
 * without clipping the master bus.
 */
export function calculateBalancedGains(
  echoEnabled: boolean,
  echoMix: number,
  reverbEnabled: boolean,
  reverbMix: number
): { dryGain: number; echoGain: number; reverbGain: number } {
  const eMix = echoEnabled ? clamp(echoMix, 0, 1) : 0;
  const rMix = reverbEnabled ? clamp(reverbMix, 0, 1) : 0;

  // Dry gain gracefully drops slightly as wet effects increase
  const dryGain = clamp(1.0 - (rMix * 0.35 + eMix * 0.25), 0.3, 1.0);
  // Wet gains boosted with warm curve
  const echoGain = eMix * 1.35;
  const reverbGain = rMix * 1.45;

  return { dryGain, echoGain, reverbGain };
}

/**
 * Converts Float32 audio samples to 16-bit Linear PCM Base64 (for 16kHz Gemini Live input).
 */
export function floatTo16BitPCMBase64(input: Float32Array): string {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(output.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes 24kHz 16-bit Linear PCM Base64 to Float32 array (for Gemini Live output).
 */
export function base64PCMToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768.0;
  }
  return float32;
}
