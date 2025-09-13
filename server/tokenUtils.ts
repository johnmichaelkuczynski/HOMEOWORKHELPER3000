// Token counting and management utilities

export function countTokens(text: string): number {
  // Simple token counting - approximately 4 characters per token
  // This is a rough estimate, but works for our purposes
  return Math.ceil(text.length / 4);
}

export function estimateOutputTokens(inputText: string): number {
  // Estimate output tokens based on input complexity
  const inputTokens = countTokens(inputText);
  
  // For homework assignments, output is typically 2-3x input length
  // Math problems tend to have longer explanations
  const isMathProblem = /\b(solve|equation|calculate|derivative|integral|limit|matrix|algebra|geometry|calculus|statistics|probability)\b/i.test(inputText);
  
  if (isMathProblem) {
    return Math.min(inputTokens * 3, 1000); // Cap at 1000 tokens
  }
  
  return Math.min(inputTokens * 2, 800); // Cap at 800 tokens
}

export function truncateResponse(response: string, maxTokens: number): string {
  const targetLength = maxTokens * 4; // Approximate characters
  
  if (response.length <= targetLength) {
    return response;
  }
  
  // Try to break at a natural point (sentence end)
  const truncated = response.substring(0, targetLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');
  
  const breakPoint = Math.max(lastPeriod, lastNewline);
  
  if (breakPoint > targetLength * 0.8) {
    return truncated.substring(0, breakPoint + 1);
  }
  
  return truncated;
}

export const TOKEN_LIMITS = {
  FREE_INPUT_LIMIT: 500,
  FREE_OUTPUT_LIMIT: 300,
  FREE_DAILY_LIMIT: 1000,
  CREDIT_TIERS: {
    '1': 2000,      // $1 → 2,000 tokens
    '10': 30000,    // $10 → 30,000 tokens
    '100': 600000,  // $100 → 600,000 tokens
    '1000': 10000000 // $1,000 → 10,000,000 tokens
  }
};

export function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}