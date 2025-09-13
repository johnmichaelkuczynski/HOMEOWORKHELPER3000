import { useState, useEffect } from "react";

const SESSION_KEY = 'homework-pro-session-id';

export function useSession() {
  const [sessionId, setSessionId] = useState<string>(() => {
    // Try to get existing session ID from localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem(SESSION_KEY) || generateSessionId();
    }
    return generateSessionId();
  });

  useEffect(() => {
    // Store session ID in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_KEY, sessionId);
    }
  }, [sessionId]);

  return sessionId;
}

function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}