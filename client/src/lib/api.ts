import { apiRequest } from "./queryClient";
import type { ProcessAssignmentResponse } from "@shared/schema";

export async function uploadFile(
  file: File, 
  llmProvider: string
): Promise<ProcessAssignmentResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('llmProvider', llmProvider);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Upload failed');
  }

  return response.json();
}

export async function processText(
  inputText: string,
  llmProvider: string
): Promise<ProcessAssignmentResponse> {
  const response = await apiRequest('POST', '/api/process-text', {
    inputText,
    llmProvider,
    inputType: 'text',
  });

  return response.json();
}

export async function getAllAssignments() {
  const response = await apiRequest('GET', '/api/assignments');
  return response.json();
}

export async function getAssignment(id: number) {
  const response = await apiRequest('GET', `/api/assignments/${id}`);
  return response.json();
}

export async function emailSolution(data: {
  email: string;
  extractedText: string;
  llmResponse: string;
  provider: string;
}) {
  const response = await fetch('/api/email-solution', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send email');
  }
  
  return response.json();
}
