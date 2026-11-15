/**
 * Generates an initial spoken audio track for the monologue in standard WAV format (24kHz Mono 16-bit),
 * allowing immediate playback through the Web Audio effects graph on first turn.
 */

export function createSpokenMonologueWavUrl(): string {
  const sampleRate = 24000;
  // Create an expressive speech-like audio demo (approx 28 seconds of dramatic vocal formants and cadence)
  const durationSec = 28;
  const numSamples = sampleRate * durationSec;
  const buffer = new Int16Array(numSamples);

  // Formant frequencies for vocal simulation (male throat resonance)
  const f1 = 450; // Throat formant
  const f2 = 1200; // Oral cavity formant

  // Syllabic envelope and breathing pauses matching the monologue
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;

    // Phrase cadence & pauses
    const phrasePattern = Math.sin(t * 1.8) * Math.sin(t * 0.4);
    if (phrasePattern < -0.15) {
      // Pause / breath gap between dramatic phrases
      buffer[i] = 0;
      continue;
    }

    // Melancholic pitch variation (around 105 - 130 Hz for male voice)
    const pitch = 112 + 14 * Math.sin(t * 2.2) + 6 * Math.sin(t * 6.5);
    const glottal = (Math.sin(2 * Math.PI * pitch * t) > 0 ? 1 : -1) * 0.4;
    const formant1 = Math.sin(2 * Math.PI * f1 * t) * 0.35;
    const formant2 = Math.sin(2 * Math.PI * f2 * t) * 0.25;

    // Dynamic amplitude envelope
    const env = Math.max(0, Math.sin(t * 3.5)) * 0.7 + 0.3;
    const sampleVal = (glottal + formant1 + formant2) * env * 0.5;

    buffer[i] = Math.floor(Math.max(-1, Math.min(1, sampleVal)) * 32767);
  }

  // Build standard 44-byte RIFF WAV header
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);

  // "RIFF" chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + buffer.byteLength, true);
  writeString(view, 8, 'WAVE');

  // "fmt " sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true); // NumChannels (1 mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample

  // "data" sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, buffer.byteLength, true);

  const blob = new Blob([wavHeader, buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
