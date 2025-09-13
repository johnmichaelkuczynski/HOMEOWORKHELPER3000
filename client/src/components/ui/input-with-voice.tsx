import { forwardRef } from 'react';
import { Input } from './input';
import { VoiceInput } from './voice-input';
import { Button } from './button';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InputWithVoiceProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onVoiceTranscript?: (text: string) => void;
  showVoiceButton?: boolean;
  showClearButton?: boolean;
}

const InputWithVoice = forwardRef<HTMLInputElement, InputWithVoiceProps>(
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
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(event);
      }
    };

    const handleClear = () => {
      if (onChange) {
        const event = {
          target: { value: '' }
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(event);
      }
    };

    const hasButtons = showVoiceButton || (showClearButton && value);
    const buttonCount = (showVoiceButton ? 1 : 0) + (showClearButton && value ? 1 : 0);
    const paddingRight = buttonCount === 2 ? "pr-16" : hasButtons ? "pr-10" : "";

    return (
      <div className="relative">
        <Input
          ref={ref}
          className={cn(paddingRight, className)}
          value={value}
          onChange={onChange}
          {...props}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
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

InputWithVoice.displayName = "InputWithVoice";

export { InputWithVoice };