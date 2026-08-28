const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Tried in order. The public Gemini endpoints return "high demand" errors
 * often enough that a single pinned model is a demo risk, so we walk down
 * the list and only then hand back to the deterministic fallback.
 *
 * Flash-Lite goes first, and the order is about quota rather than quality.
 * On the free tier the Flash models allow 20 requests a day; Flash-Lite
 * allows 500. Leading with Flash meant every brief spent two doomed calls
 * exhausting the small quota before landing on the model that was going to
 * answer anyway — visible in AI Studio as 48/20 and 44/20 peak usage against
 * a limit of twenty, and felt as two extra round trips of latency in front of
 * every response.
 *
 * The bigger models stay as fallbacks. They are better when they are
 * available, and now they still have their twenty requests left for the days
 * Flash-Lite is rate limited, instead of being spent before anyone asks.
 */
const MODELS = ['gemini-flash-lite-latest', 'gemini-3.6-flash', 'gemini-flash-latest'];

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
