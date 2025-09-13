import { useState, useRef } from 'react';
import { Mic, MicOff, Square } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface AzureSpeechInputProps {
  onResult: (text: string) => void;
  onInterim?: (text: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function AzureSpeechInput({ onResult, onInterim, className, size = 'md' }: AzureSpeechInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognizerRef = useRef<any>(null);
  const accumulatedTextRef = useRef('');

  const startRecording = async () => {
    try {
      // Dynamic import to avoid SSR issues
      const SpeechSDK = await import('microsoft-cognitiveservices-speech-sdk');
      
      // Get Azure Speech credentials from backend
      const response = await fetch('/api/azure-speech-config');
      const { subscriptionKey, region } = await response.json();
      
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(subscriptionKey, region);

      speechConfig.speechRecognitionLanguage = 'en-US';
      speechConfig.enableDictation();

      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      recognizerRef.current = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

      // Clear accumulated text
      accumulatedTextRef.current = '';

      recognizerRef.current.recognizing = (s: any, e: any) => {
        const interimText = e.result.text;
        if (onInterim && interimText) {
          // Show accumulated final text + current interim text
          const totalText = accumulatedTextRef.current + interimText;
          onInterim(totalText.trim());
        }
      };

      recognizerRef.current.recognized = (s: any, e: any) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech && e.result.text) {
          const finalText = e.result.text;
          // Accumulate the recognized text
          accumulatedTextRef.current += finalText + ' ';
          onResult(finalText);
          
          // Update interim display with accumulated text
          if (onInterim) {
            onInterim(accumulatedTextRef.current.trim());
          }
        }
      };

      recognizerRef.current.canceled = (s: any, e: any) => {
        console.log(`CANCELED: Reason=${e.reason}`);
        if (e.reason === SpeechSDK.CancellationReason.Error) {
          setError(`Speech recognition error: ${e.errorDetails}`);
        }
        setIsRecording(false);
      };

      recognizerRef.current.sessionStopped = (s: any, e: any) => {
        setIsRecording(false);
      };

      // Start continuous recognition
      recognizerRef.current.startContinuousRecognitionAsync(
        () => {
          console.log('Azure Speech recognition started');
          setIsRecording(true);
          setError(null);
        },
        (err: any) => {
          console.error('Failed to start Azure Speech recognition:', err);
          setError(`Failed to start recording: ${err}`);
          setIsRecording(false);
        }
      );

    } catch (err) {
      setError(`Speech service error: ${err}`);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recognizerRef.current) {
      recognizerRef.current.stopContinuousRecognitionAsync(
        () => {
          setIsRecording(false);
          // Send final accumulated text and clear
          if (accumulatedTextRef.current.trim() && onResult) {
            onResult(accumulatedTextRef.current.trim());
          }
          accumulatedTextRef.current = '';
          if (onInterim) {
            onInterim('');
          }
        },
        (err: any) => {
          console.error('Error stopping recognition:', err);
          setIsRecording(false);
        }
      );
    }
  };

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

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