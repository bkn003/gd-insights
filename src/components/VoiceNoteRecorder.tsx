import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Play, Pause, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface VoiceNoteRecorderProps {
  onVoiceNoteChange: (file: File | null) => void;
  existingVoiceUrl?: string;
}

export const VoiceNoteRecorder = ({ onVoiceNoteChange, existingVoiceUrl }: VoiceNoteRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(existingVoiceUrl || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSupported, setIsSupported] = useState(true);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check if MediaRecorder is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsSupported(false);
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl && !existingVoiceUrl) URL.revokeObjectURL(audioUrl);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        setAudioBlob(blob);
        
        if (audioUrl && !existingVoiceUrl) URL.revokeObjectURL(audioUrl);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        // Create file from blob
        const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: blob.type });
        onVoiceNoteChange(file);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('Could not access microphone. Please grant permission.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const playAudio = () => {
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

  const deleteRecording = () => {
    if (audioUrl && !existingVoiceUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    onVoiceNoteChange(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isSupported) {
    return (
      <div className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
        Voice recording is not supported in this browser.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}
      
      {!audioUrl ? (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant={isRecording ? "destructive" : "outline"}
            size="lg"
            onClick={isRecording ? stopRecording : startRecording}
            className="gap-2"
          >
            {isRecording ? (
              <>
                <Square className="h-4 w-4 fill-current" />
                Stop ({formatTime(recordingTime)})
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" />
                Record Voice Note
              </>
            )}
          </Button>
          
          {isRecording && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm text-muted-foreground">Recording...</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={playAudio}
            className="h-10 w-10"
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </Button>
          
          <div className="flex-1">
            <div className="h-2 bg-primary/20 rounded-full overflow-hidden">
              <div 
                className={`h-full bg-primary transition-all duration-300 ${isPlaying ? 'animate-pulse' : ''}`}
                style={{ width: isPlaying ? '100%' : '0%' }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Voice note recorded ({formatTime(recordingTime)})
            </p>
          </div>
          
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={deleteRecording}
            className="h-8 w-8 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};
