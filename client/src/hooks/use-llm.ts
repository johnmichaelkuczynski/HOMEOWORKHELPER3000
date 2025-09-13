import { useMutation } from '@tanstack/react-query';
import { uploadFile, processText } from '@/lib/api';

export function useLLMProcessor() {
  const uploadMutation = useMutation({
    mutationFn: ({ file, provider }: { file: File; provider: string }) =>
      uploadFile(file, provider),
  });

  const textMutation = useMutation({
    mutationFn: ({ text, provider }: { text: string; provider: string }) =>
      processText(text, provider),
  });

  return {
    uploadFile: uploadMutation.mutate,
    processText: textMutation.mutate,
    isProcessing: uploadMutation.isPending || textMutation.isPending,
    error: uploadMutation.error || textMutation.error,
    uploadMutation,
    textMutation,
  };
}
