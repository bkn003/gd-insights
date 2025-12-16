import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';

interface VoiceNotePlayerProps {
  voiceUrl: string;
  compact?: boolean;
}

// Format seconds to M:SS
const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const VoiceNotePlayer = ({ voiceUrl, compact = false }: VoiceNotePlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Generate pseudo-waveform bars (consistent pattern per URL)
  const waveformBars = useMemo(() => {
    const bars: number[] = [];
    const numBars = compact ? 30 : 45;
    let hash = 0;
    for (let i = 0; i < voiceUrl.length; i++) {
      hash = ((hash << 5) - hash) + voiceUrl.charCodeAt(i);
      hash |= 0;
    }
    for (let i = 0; i < numBars; i++) {
      const seed = Math.abs(Math.sin(hash * (i + 1)) * 10000);
      bars.push(0.25 + (seed % 75) / 100);
    }
    return bars;
  }, [voiceUrl, compact]);

  // Progress percentage (0-100)
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Smooth progress update using requestAnimationFrame
  const updateProgress = useCallback(() => {
    if (audioRef.current && isPlaying && !isDragging) {
      setCurrentTime(audioRef.current.currentTime);
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    }
  }, [isPlaying, isDragging]);

  useEffect(() => {
    if (isPlaying && !isDragging) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, isDragging, updateProgress]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().catch(console.error);
        setIsPlaying(true);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setIsLoaded(true);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(duration); // Set to end position first for visual feedback
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
    // Reset after a brief moment so user sees the bar reach the end
    setTimeout(() => setCurrentTime(0), 100);
  };

  // Native timeupdate event for reliable seek bar sync
  const handleTimeUpdate = () => {
    if (audioRef.current && !isDragging) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  // Calculate new time from click/touch position
  const getTimeFromPosition = (clientX: number): number => {
    if (!waveformRef.current || !duration) return 0;
    const rect = waveformRef.current.getBoundingClientRect();
    const position = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
    return position * duration;
  };

  // Seek to position
  const seekTo = (newTime: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  // Mouse/Touch handlers for seeking
  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isLoaded) return;
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    seekTo(getTimeFromPosition(clientX));
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      seekTo(getTimeFromPosition(clientX));
    };

    const handleUp = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDragging, duration]);

  // Compact mode for table cells (like WhatsApp)
  if (compact) {
    return (
      <div className="flex items-center gap-2 min-w-[150px] max-w-[200px] mx-auto">
        <audio
          ref={audioRef}
          src={voiceUrl}
          preload="metadata"
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          onTimeUpdate={handleTimeUpdate}
        />

        {/* Play/Pause Button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={togglePlay}
          className="h-7 w-7 shrink-0 text-primary hover:text-primary hover:bg-primary/10 rounded-full"
        >
          {isPlaying ? (
            <Pause className="h-4 w-4 fill-current" />
          ) : (
            <Play className="h-4 w-4 fill-current ml-0.5" />
          )}
        </Button>

        {/* Waveform with Seek Bar */}
        <div
          ref={waveformRef}
          className="flex-1 h-7 cursor-pointer relative select-none"
          onMouseDown={handlePointerDown}
          onTouchStart={handlePointerDown}
        >
          {/* Waveform Bars */}
          <div className="absolute inset-0 flex items-center gap-[1px]">
            {waveformBars.map((height, index) => {
              const barPercent = ((index + 0.5) / waveformBars.length) * 100;
              const isPlayed = barPercent <= progress;
              return (
                <div
                  key={index}
                  className="flex-1 rounded-full transition-colors duration-75"
                  style={{
                    height: `${height * 100}%`,
                    minWidth: '2px',
                    maxWidth: '3px',
                    backgroundColor: isPlayed
                      ? 'hsl(var(--primary))'
                      : 'hsl(var(--muted-foreground) / 0.35)'
                  }}
                />
              );
            })}
          </div>

          {/* Seek Dot/Circle (WhatsApp style) */}
          <div
            className="absolute top-1/2 z-20 pointer-events-none"
            style={{
              left: `${progress}%`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div
              className="w-3 h-3 rounded-full bg-primary shadow-md"
              style={{
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
              }}
            />
          </div>
        </div>

        {/* Time display */}
        <span className="text-xs text-muted-foreground tabular-nums min-w-[28px] text-right">
          {formatTime(currentTime)}
        </span>
      </div>
    );
  }

  // Full mode for card view
  return (
    <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/10">
      <audio
        ref={audioRef}
        src={voiceUrl}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onTimeUpdate={handleTimeUpdate}
      />

      {/* Play/Pause Button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={togglePlay}
        className="h-10 w-10 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {isPlaying ? (
          <Pause className="h-5 w-5 fill-current" />
        ) : (
          <Play className="h-5 w-5 fill-current ml-0.5" />
        )}
      </Button>

      {/* Waveform with Seek Bar */}
      <div
        ref={waveformRef}
        className="flex-1 h-10 cursor-pointer relative select-none"
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
      >
        {/* Waveform Bars */}
        <div className="absolute inset-0 flex items-center gap-[1px]">
          {waveformBars.map((height, index) => {
            const barPercent = ((index + 0.5) / waveformBars.length) * 100;
            const isPlayed = barPercent <= progress;
            return (
              <div
                key={index}
                className="flex-1 rounded-full transition-colors duration-75"
                style={{
                  height: `${height * 100}%`,
                  minWidth: '2px',
                  maxWidth: '4px',
                  backgroundColor: isPlayed
                    ? 'hsl(var(--primary))'
                    : 'hsl(var(--muted-foreground) / 0.35)'
                }}
              />
            );
          })}
        </div>

        {/* Seek Dot/Circle (WhatsApp style) */}
        <div
          className="absolute top-1/2 z-20 pointer-events-none"
          style={{
            left: `${progress}%`,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div
            className="w-4 h-4 rounded-full bg-primary shadow-lg ring-2 ring-white"
            style={{
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
          />
        </div>
      </div>

      {/* Time display */}
      <span className="text-sm text-muted-foreground tabular-nums min-w-[36px] text-right font-medium">
        {formatTime(currentTime)}
      </span>
    </div>
  );
};
