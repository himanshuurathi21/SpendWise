import { isSupabaseConfigured } from '@/core/api/supabase';

interface GeminiContentPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiContent {
  role?: string;
  parts: GeminiContentPart[];
}

interface GeminiGenerationConfig {
  temperature?: number;
  responseMimeType?: string;
  maxOutputTokens?: number;
  topP?: number;
}

interface GeminiCallParams {
  contents: GeminiContent[];
  generationConfig?: GeminiGenerationConfig;
  system_instruction?: { parts: GeminiContentPart[] };
}

/**
 * Universal Gemini caller for SpendWise.
 * Dynamically routes queries:
 * 1. Safe Production Proxy: Calls Supabase Edge Function proxy (GAP-B) if Supabase is configured.
 * 2. Local Fallback: Direct call to Google APIs if local VITE_GEMINI_API_KEY is present in dev.
 */
export async function callGemini(params: GeminiCallParams): Promise<Record<string, unknown>> {
  const localApiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (isSupabaseConfigured) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const sessionToken = sessionStorage.getItem('spendwise_supabase_token') || supabaseAnonKey;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/gemini-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(params),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorMsg = await response.text();
        throw new Error(
          `Edge Function error (${response.status}): ${errorMsg || response.statusText}`
        );
      }

      return await response.json();
    } catch (e) {
      clearTimeout(timeoutId);
      console.warn(
        'Supabase Edge Function proxy failed, attempting local fallback if key exists:',
        e
      );
      if (!localApiKey) throw e;
    }
  }

  if (localApiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${localApiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message ?? `Gemini Direct API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  }

  throw new Error(
    'Gemini API is not configured. Setup Supabase Edge Function or add VITE_GEMINI_API_KEY to .env'
  );
}

/**
 * Streaming Gemini caller — yields text chunks as they arrive from the API.
 * Falls back to a single-chunk yield when streaming is not available (e.g. Supabase proxy).
 */
export async function* streamGemini(params: GeminiCallParams): AsyncGenerator<string> {
  const localApiKey = import.meta.env.VITE_GEMINI_API_KEY;

  // Supabase proxy doesn't support SSE streaming — fall back to batch call and yield full text
  if (isSupabaseConfigured) {
    try {
      const data = await callGemini(params);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (data as any).candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      yield text;
      return;
    } catch (e) {
      if (!localApiKey) throw e;
    }
  }

  if (!localApiKey) {
    throw new Error('Gemini streaming requires VITE_GEMINI_API_KEY');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${localApiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok || !response.body) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `Gemini Stream Error: ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Each SSE event is separated by "\n\n"; lines starting with "data: " carry the JSON
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      for (const line of part.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') return;
        try {
          const json = JSON.parse(raw);
          const chunk = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (chunk) yield chunk;
        } catch {
          /* silently ignore — non-critical */
        }
      }
    }
  }
}
