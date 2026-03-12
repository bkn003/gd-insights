import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';

interface VoiceNotePlayerProps {
  voiceUrl: string;
  compact?: boolean;
}

const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2];

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const VoiceNotePlayer = ({ voiceUrl, compact = false }: VoiceNotePlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [progressPercent, setProgressPercent] = useState(0);
  const [displayTime, setDisplayTime] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const waveformCompactRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const isDraggingRef = useRef(false);

  // Keep refs in sync with state to avoid stale closures
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { isDraggingRef.current = isDragging; }, [isDragging]);

  const waveformBars = useMemo(() => {
    const bars: number[] = [];
    const numBars = compact ? 35 : 50;
    let hash = 0;
    for (let i = 0; i < voiceUrl.length; i++) {
      hash = ((hash << 5) - hash) + voiceUrl.charCodeAt(i);
      hash |= 0;
    }
    for (let i = 0; i < numBars; i++) {
      const seed = Math.abs(Math.sin(hash * (i + 1)) * 10000);
      bars.push(0.2 + (seed % 80) / 100);
    }
    return bars;
  }, [voiceUrl, compact]);

  // Animation frame loop using refs to avoid stale closures
  const updateProgressFrame = useCallback(() => {
    if (audioRef.current && !isDraggingRef.current) {
      const currentTime = audioRef.current.currentTime;
      const audioDuration = audioRef.current.duration || 1;
      setProgressPercent((currentTime / audioDuration) * 100);
      setDisplayTime(currentTime);
    }
    
    if (isPlayingRef.current && !isDraggingRef.current) {
      animationFrameRef.current = requestAnimationFrame(updateProgressFrame);
    }
  }, []);

  const startAnimationLoop = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(updateProgressFrame);
  }, [updateProgressFrame]);

  const stopAnimationLoop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAnimationLoop();
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [stopAnimationLoop]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const cyclePlaybackSpeed = useCallback(() => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    setPlaybackSpeed(PLAYBACK_SPEEDS[nextIndex]);
  }, [playbackSpeed]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    
    if (isPlayingRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      isPlayingRef.current = false;
      stopAnimationLoop();
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        isPlayingRef.current = true;
        startAnimationLoop();
      }).catch(console.error);
    }
  }, [startAnimationLoop, stopAnimationLoop]);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setIsLoaded(true);
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    stopAnimationLoop();
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
    setProgressPercent(0);
    setDisplayTime(0);
  }, [stopAnimationLoop]);

  const getTimeFromPosition = useCallback((clientX: number): number => {
    const ref = compact ? waveformCompactRef.current : waveformRef.current;
    if (!ref || !duration) return 0;
    const rect = ref.getBoundingClientRect();
    const position = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
    return position * duration;
  }, [compact, duration]);

  const seekTo = useCallback((newTime: number) => {
    if (audioRef.current && duration > 0) {
      const clampedTime = Math.max(0, Math.min(newTime, duration));
      audioRef.current.currentTime = clampedTime;
      setProgressPercent((clampedTime / duration) * 100);
      setDisplayTime(clampedTime);
    }
  }, [duration]);

  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isLoaded || !duration) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    isDraggingRef.current = true;
    stopAnimationLoop();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    seekTo(getTimeFromPosition(clientX));
  }, [isLoaded, duration, getTimeFromPosition, seekTo, stopAnimationLoop]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      seekTo(getTimeFromPosition(clientX));
    };

    const handleUp = () => {
      setIsDragging(false);
      isDraggingRef.current = false;
      if (isPlayingRef.current) {
        startAnimationLoop();
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDragging, getTimeFromPosition, seekTo, startAnimationLoop]);

  // Compact mode
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 min-w-[180px] max-w-[240px] mx-auto bg-muted/40 rounded-full px-1.5 py-1">
        <audio
          ref={audioRef}
          src={voiceUrl}
          preload="metadata"
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={togglePlay}
          className="h-7 w-7 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isPlaying ? <Pause className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current ml-0.5" />}
        </Button>
        <div
          ref={waveformCompactRef}
          className="flex-1 h-8 cursor-pointer relative select-none overflow-hidden touch-none"
          onMouseDown={handlePointerDown}
          onTouchStart={handlePointerDown}
        >
          <div className="absolute inset-0 flex items-center gap-px pointer-events-none">
            {waveformBars.map((height, index) => {
              const barPercent = ((index + 0.5) / waveformBars.length) * 100;
              const isPlayed = barPercent <= progressPercent;
              return (
                <div
                  key={index}
                  className="flex-1 rounded-full transition-colors duration-75"
                  style={{
                    height: `${height * 100}%`,
                    minWidth: '2px',
                    maxWidth: '3px',
                    backgroundColor: isPlayed ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.3)',
                  }}
                />
              );
            })}
          </div>
          <div
            className="absolute top-1/2 z-20 pointer-events-none"
            style={{
              left: `${progressPercent}%`,
              transform: 'translate(-50%, -50%)',
              transition: isDragging ? 'none' : 'left 0.05s linear'
            }}
          >
            <div className="w-3 h-3 rounded-full bg-primary shadow-md border-2 border-background" />
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums min-w-[24px] text-right">
          {isPlaying || displayTime > 0 ? formatTime(displayTime) : formatTime(duration)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={cyclePlaybackSpeed}
          className="h-5 px-1 text-[9px] font-medium text-muted-foreground hover:text-foreground shrink-0"
        >
          {playbackSpeed}x
        </Button>
      </div>
    );
  }

  // Full mode
  return (
    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-2xl border border-border/50">
      <audio
        ref={audioRef}
        src={voiceUrl}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={togglePlay}
        className="h-11 w-11 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
      >
        {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
      </Button>
      <div
        ref={waveformRef}
        className="flex-1 h-10 cursor-pointer relative select-none overflow-hidden touch-none"
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
      >
        <div className="absolute inset-0 flex items-center gap-[1px] pointer-events-none">
          {waveformBars.map((height, index) => {
            const barPercent = ((index + 0.5) / waveformBars.length) * 100;
            const isPlayed = barPercent <= progressPercent;
            return (
              <div
                key={index}
                className="flex-1 rounded-full transition-colors duration-75"
                style={{
                  height: `${height * 100}%`,
                  minWidth: '2px',
                  maxWidth: '4px',
                  backgroundColor: isPlayed ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.3)',
                }}
              />
            );
          })}
        </div>
        <div
          className="absolute top-1/2 z-20 pointer-events-none"
          style={{
            left: `${progressPercent}%`,
            transform: 'translate(-50%, -50%)',
            transition: isDragging ? 'none' : 'left 0.05s linear'
          }}
        >
          <div className="w-4 h-4 rounded-full bg-primary shadow-lg border-2 border-background" />
        </div>
      </div>
      <div className="flex flex-col items-end min-w-[36px]">
        <span className="text-sm text-foreground tabular-nums font-medium">
          {isPlaying || displayTime > 0 ? formatTime(displayTime) : formatTime(duration)}
        </span>
        {duration > 0 && (isPlaying || displayTime > 0) && (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            / {formatTime(duration)}
          </span>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={cyclePlaybackSpeed}
        className="h-7 px-2 text-xs font-medium shrink-0"
      >
        {playbackSpeed}x
      </Button>
    </div>
  );
};
