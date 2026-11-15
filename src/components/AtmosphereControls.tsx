import React, { useState, useEffect } from 'react';
import { CloudRain, Volume2, VolumeX, Moon, Disc } from 'lucide-react';
import { ambientSound } from '../utils/audioSynthesizer';

interface AtmosphereControlsProps {
  atmosphereTheme: 'noir' | 'midnight' | 'amber';
  onThemeChange: (theme: 'noir' | 'midnight' | 'amber') => void;
}

export const AtmosphereControls: React.FC<AtmosphereControlsProps> = ({
  atmosphereTheme,
  onThemeChange,
}) => {
  const [isRainPlaying, setIsRainPlaying] = useState<boolean>(false);
  const [rainVolume, setRainVolume] = useState<number>(0.25);

  const toggleRain = () => {
    if (isRainPlaying) {
      ambientSound.stop();
      setIsRainPlaying(false);
    } else {
      ambientSound.start();
      ambientSound.setVolume(rainVolume);
      setIsRainPlaying(true);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setRainVolume(val);
    if (isRainPlaying) {
      ambientSound.setVolume(val);
    }
  };

  useEffect(() => {
    return () => {
      ambientSound.stop();
    };
  }, []);

  return (
    <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-4 shadow-xl text-zinc-200 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <CloudRain className={`w-4 h-4 ${isRainPlaying ? 'text-cyan-400 animate-pulse' : 'text-zinc-400'}`} />
          <span className="text-xs font-semibold tracking-wide uppercase text-zinc-300">
            Кінематографічна атмосфера
          </span>
        </div>
        <span className="text-[11px] text-zinc-400 flex items-center gap-1">
          <Disc className={`w-3.5 h-3.5 ${isRainPlaying ? 'animate-spin' : ''}`} />
          Дощ + Вініл
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
        {/* Play/Stop Ambience */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={toggleRain}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isRainPlaying
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/50 shadow-sm shadow-cyan-500/20'
                : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-750'
            }`}
          >
            {isRainPlaying ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Звук дощу активний</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-zinc-400" />
                <span>Увімкнути атмосферу дощу</span>
              </>
            )}
          </button>

          {isRainPlaying && (
            <div className="flex items-center gap-2 flex-1 sm:w-32">
              <input
                type="range"
                min="0.05"
                max="0.8"
                step="0.05"
                value={rainVolume}
                onChange={handleVolumeChange}
                aria-label="Гучність фонового дощу"
                className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <span className="text-[11px] text-zinc-400 font-mono w-7 text-right">
                {Math.round(rainVolume * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* Ambient Theme Preset */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
          <span className="text-[11px] text-zinc-400 mr-1 flex items-center gap-1">
            <Moon className="w-3 h-3" />
            Освітлення:
          </span>
          <button
            type="button"
            onClick={() => onThemeChange('noir')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
              atmosphereTheme === 'noir'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Нуар
          </button>
          <button
            type="button"
            onClick={() => onThemeChange('midnight')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
              atmosphereTheme === 'midnight'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Ніч
          </button>
          <button
            type="button"
            onClick={() => onThemeChange('amber')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
              atmosphereTheme === 'amber'
                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Бурштин
          </button>
        </div>
      </div>
    </div>
  );
};
