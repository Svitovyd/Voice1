/**
 * Web Audio API synthesizer for noir cinematic ambience (rain, vinyl crackle, warm drone)
 * and audio analysis for visualizers.
 */

class AmbientSoundEngine {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private masterGain: GainNode | null = null;
  private rainNode: AudioNode | null = null;
  private droneNode: AudioNode | null = null;
  private vinylTimer: number | null = null;

  public init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.25, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(val: number) {
    if (this.masterGain && this.ctx) {
      const clamped = Math.max(0, Math.min(1, val));
      this.masterGain.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.05);
    }
  }

  public start() {
    this.init();
    if (!this.ctx || !this.masterGain || this.isPlaying) return;
    this.isPlaying = true;

    try {
      // 1. Synthesize gentle rain with filtered pink noise
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
        b6 = white * 0.115926;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, this.ctx.currentTime);

      const rainGain = this.ctx.createGain();
      rainGain.gain.setValueAtTime(0.35, this.ctx.currentTime);

      whiteNoise.connect(filter);
      filter.connect(rainGain);
      rainGain.connect(this.masterGain);
      whiteNoise.start();
      this.rainNode = whiteNoise;

      // 2. Cinematic moody drone chord (D minor / root + fifth)
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const droneGain = this.ctx.createGain();
      const droneFilter = this.ctx.createBiquadFilter();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(73.42, this.ctx.currentTime); // D2

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(110.0, this.ctx.currentTime); // A2

      droneFilter.type = 'lowpass';
      droneFilter.frequency.setValueAtTime(220, this.ctx.currentTime);

      droneGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

      osc1.connect(droneFilter);
      osc2.connect(droneFilter);
      droneFilter.connect(droneGain);
      droneGain.connect(this.masterGain);

      osc1.start();
      osc2.start();
      this.droneNode = osc1;

      // 3. Subtle periodic vinyl clicks
      this.vinylTimer = window.setInterval(() => {
        if (!this.ctx || !this.masterGain || !this.isPlaying) return;
        if (Math.random() > 0.4) {
          const clickOsc = this.ctx.createOscillator();
          const clickGain = this.ctx.createGain();
          clickOsc.type = 'square';
          clickOsc.frequency.setValueAtTime(800 + Math.random() * 2000, this.ctx.currentTime);
          clickGain.gain.setValueAtTime(0.015, this.ctx.currentTime);
          clickGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.015);
          clickOsc.connect(clickGain);
          clickGain.connect(this.masterGain);
          clickOsc.start();
          clickOsc.stop(this.ctx.currentTime + 0.02);
        }
      }, 350);
    } catch (e) {
      console.warn('Failed to start ambient audio:', e);
    }
  }

  public stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    try {
      if (this.rainNode) {
        (this.rainNode as AudioScheduledSourceNode).stop();
        this.rainNode.disconnect();
        this.rainNode = null;
      }
      if (this.droneNode) {
        (this.droneNode as AudioScheduledSourceNode).stop();
        this.droneNode.disconnect();
        this.droneNode = null;
      }
      if (this.vinylTimer) {
        clearInterval(this.vinylTimer);
        this.vinylTimer = null;
      }
    } catch (e) {
      console.warn('Error stopping ambient audio:', e);
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

export const ambientSound = new AmbientSoundEngine();
