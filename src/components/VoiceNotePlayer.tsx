import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2 } from 'lucide-react';

interface VoiceNotePlayerProps {
  voiceUrl: string;
  compact?: boolean;
}

export const VoiceNotePlayer = ({ voiceUrl, compact = false }: VoiceNotePlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const duration = audioRef.current.duration;
      setProgress((current / duration) * 100);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
  };

  if (compact) {
    return (
      <>
        <audio
          ref={audioRef}
          src={voiceUrl}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={togglePlay}
          className="h-7 w-7 shrink-0"
          title="Play voice note"
        >
          {isPlaying ? (
            <Pause className="h-3.5 w-3.5 text-primary" />
          ) : (
            <Play className="h-3.5 w-3.5 text-primary fill-current" />
          )}
        </Button>
      </>
    );
  }

  return (
    <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg border border-primary/20">
      <audio
        ref={audioRef}
        src={voiceUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={togglePlay}
        className="h-8 w-8 shrink-0"
      >
        {isPlaying ? (
          <Pause className="h-4 w-4 text-primary" />
        ) : (
          <Play className="h-4 w-4 text-primary" />
        )}
      </Button>

      <div className="flex-1 min-w-[60px]">
        <div className="h-1.5 bg-primary/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <Volume2 className="h-4 w-4 text-primary/60 shrink-0" />
    </div>
  );
};
