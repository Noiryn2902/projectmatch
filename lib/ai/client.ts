const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Tried in order. The public Gemini endpoints return "high demand" errors
 * often enough that a single pinned model is a demo risk, so we walk down
 * the list and only then hand back to the deterministic fallback.
 */
const MODELS = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-flash-lite-latest'];

const TIMEOUT_MS = 9000;

export type JsonSchema = Record<string, unknown>;

export async function generateJson<T>(
  prompt: string,
  responseSchema: JsonSchema,
): Promise<{ data: T; model: string } | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  for (const model of MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(`${ENDPOINT}/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0.2,
          },
        }),
      });

      if (!res.ok) continue;

      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== 'string') continue;

      return { data: JSON.parse(text) as T, model };
    } catch {
      // timeout, abort, network error, or unparseable body: try the next model
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}
