import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Square } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface SpeechInputProps {
  onResult: (text: string) => void;
  onInterim?: (text: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function SpeechInput({ onResult, onInterim, className, size = 'md' }: SpeechInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const isInitializedRef = useRef(false);
  const accumulatedTextRef = useRef('');

  useEffect(() => {
    // Check for speech recognition support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition && !isInitializedRef.current) {
      setIsSupported(true);
      isInitializedRef.current = true;
      
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsRecording(true);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        // Accumulate final text
        if (finalTranscript.trim()) {
          accumulatedTextRef.current += finalTranscript;
          console.log('Final transcript:', finalTranscript.trim());
          console.log('Accumulated text:', accumulatedTextRef.current);
          onResult(finalTranscript.trim());
        }

        // Show current accumulated + interim text for live feedback
        if (onInterim) {
          const totalText = accumulatedTextRef.current + interimTranscript;
          console.log('Interim text:', interimTranscript);
          console.log('Total text for preview:', totalText.trim());
          onInterim(totalText.trim());
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'aborted') {
          setError(`Recording failed: ${event.error}`);
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
        // Don't automatically restart - let user control when to start/stop
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current && isRecording) {
        recognitionRef.current.stop();
      }
    };
  }, [onResult, isRecording]);

  const startRecording = async () => {
    if (!recognitionRef.current) return;

    try {
      // Clear accumulated text when starting new recording
      accumulatedTextRef.current = '';
      
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      recognitionRef.current.start();
    } catch (err) {
      setError('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      // Clear accumulated text when stopping
      accumulatedTextRef.current = '';
    }
  };

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  if (!isSupported) {
    return null;
  }

  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8', 
    lg: 'h-10 w-10'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <Button
      type="button"
      variant={isRecording ? "destructive" : "outline"}
      size="sm"
      className={cn(
        sizeClasses[size],
        "p-1 transition-all duration-200",
        isRecording && "animate-pulse",
        error && "border-red-300 bg-red-50",
        className
      )}
      onClick={handleClick}
      title={error || (isRecording ? "Stop recording" : "Start voice input")}
    >
      {isRecording ? (
        <Square className={cn(iconSizes[size], "fill-current")} />
      ) : error ? (
        <MicOff className={cn(iconSizes[size], "text-red-500")} />
      ) : (
        <Mic className={iconSizes[size]} />
      )}
    </Button>
  );
}

