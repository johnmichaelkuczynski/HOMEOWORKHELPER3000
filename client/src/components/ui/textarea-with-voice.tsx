import { forwardRef } from 'react';
import { Textarea } from './textarea';
import { VoiceInput } from './voice-input';
import { Button } from './button';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TextareaWithVoiceProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onVoiceTranscript?: (text: string) => void;
  showVoiceButton?: boolean;
  showClearButton?: boolean;
}

const TextareaWithVoice = forwardRef<HTMLTextAreaElement, TextareaWithVoiceProps>(
  ({ className, onVoiceTranscript, showVoiceButton = true, showClearButton = true, onChange, value, ...props }, ref) => {
    const handleVoiceTranscript = (transcript: string) => {
      if (onVoiceTranscript) {
        onVoiceTranscript(transcript);
      } else if (onChange) {
        // Append transcript to existing value instead of replacing
        const currentValue = String(value || '');
        const newValue = currentValue ? currentValue + ' ' + transcript : transcript;
        const event = {
          target: { value: newValue }
        } as React.ChangeEvent<HTMLTextAreaElement>;
        onChange(event);
      }
    };

    const handleClear = () => {
      if (onChange) {
        const event = {
          target: { value: '' }
        } as React.ChangeEvent<HTMLTextAreaElement>;
        onChange(event);
      }
    };

    const hasButtons = showVoiceButton || (showClearButton && value);
    const buttonCount = (showVoiceButton ? 1 : 0) + (showClearButton && value ? 1 : 0);
    const paddingRight = buttonCount === 2 ? "pr-20" : hasButtons ? "pr-12" : "";

    return (
      <div className="relative">
        <Textarea
          ref={ref}
          className={cn(paddingRight, className)}
          value={value}
          onChange={onChange}
          {...props}
        />
        <div className="absolute right-2 top-2 flex items-center gap-1">
          {showClearButton && value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-gray-100"
              onClick={handleClear}
              title="Clear field"
            >
              <X className="w-3 h-3 text-gray-400" />
            </Button>
          )}
          {showVoiceButton && (
            <VoiceInput
              onTranscript={handleVoiceTranscript}
              size="sm"
            />
          )}
        </div>
      </div>
    );
  }
);

TextareaWithVoice.displayName = "TextareaWithVoice";

export { TextareaWithVoice };