import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isPlaying: boolean;
  audioElement?: HTMLAudioElement | null;
  analyserNode?: AnalyserNode | null;
  accentColor?: string;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isPlaying,
  analyserNode,
  accentColor = '#f59e0b',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;

    const render = () => {
      animFrameRef.current = requestAnimationFrame(render);
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const barCount = 36;
      const barWidth = width / barCount - 3;
      const centerY = height / 2;

      let freqData: Uint8Array<ArrayBuffer> | null = null;
      if (analyserNode && isPlaying) {
        freqData = new Uint8Array(new ArrayBuffer(analyserNode.frequencyBinCount));
        analyserNode.getByteFrequencyData(freqData);
      }

      phase += 0.04;

      for (let i = 0; i < barCount; i++) {
        let normalizedHeight = 0.12;

        if (isPlaying && freqData) {
          const freqIndex = Math.floor((i / barCount) * (freqData.length * 0.75));
          const val = freqData[freqIndex] || 0;
          normalizedHeight = Math.max(0.08, (val / 255) * 0.9);
        } else if (isPlaying) {
          // Synthetic wave if analyser is temporarily idle
          normalizedHeight = 0.2 + 0.35 * Math.abs(Math.sin(phase + i * 0.25));
        } else {
          // Idle ambient resting wave
          normalizedHeight = 0.1 + 0.06 * Math.sin(phase * 0.5 + i * 0.18);
        }

        const barHeight = Math.max(4, normalizedHeight * height * 0.85);
        const x = i * (barWidth + 3) + 1.5;
        const y = centerY - barHeight / 2;

        const grad = ctx.createLinearGradient(0, centerY - barHeight / 2, 0, centerY + barHeight / 2);
        if (isPlaying) {
          grad.addColorStop(0, accentColor);
          grad.addColorStop(0.5, '#fbbf24');
          grad.addColorStop(1, '#ef4444');
        } else {
          grad.addColorStop(0, '#52525b');
          grad.addColorStop(1, '#27272a');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 3);
        ctx.fill();
      }
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, accentColor, analyserNode]);

  return (
    <div className="w-full flex items-center justify-center p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 backdrop-blur-md shadow-inner">
      <canvas
        ref={canvasRef}
        width={540}
        height={72}
        className="w-full max-w-lg h-16 pointer-events-none"
        aria-label="Аудіовізуалізатор спектра"
      />
    </div>
  );
};
