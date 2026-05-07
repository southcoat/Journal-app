import * as FileSystem from 'expo-file-system';

const MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite'];

async function callGemini(base64: string, mimeType: string, apiKey: string, model: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: 'Transcribe this audio recording verbatim. Return only the transcribed text, no commentary.' },
          ],
        }],
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error?: { message?: string } };
    const msg = err?.error?.message ?? `Transcription failed (${response.status})`;
    const isRateLimit = response.status === 429 || response.status === 503;
    // Parse "Please retry in X.XXs." from the error message
    const retryMatch = msg.match(/retry in ([\d.]+)s/i);
    const retryAfterMs = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) * 1000 + 2000 : 65000;
    const error = Object.assign(new Error(msg), { isRateLimit, retryAfterMs });
    throw error;
  }

  const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error('Gemini returned an empty transcription.');
  return text;
}

export async function transcribeAudio(
  audioUri: string,
  apiKey: string,
): Promise<string> {
  if (!apiKey) throw new Error('Google AI Studio API key is not set. Add it in Settings.');

  const base64 = await FileSystem.readAsStringAsync(audioUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const ext = audioUri.split('.').pop()?.toLowerCase();
  const mimeType = ext === 'wav' ? 'audio/wav' : 'audio/mp4';

  for (const model of MODELS) {
    try {
      return await callGemini(base64, mimeType, apiKey, model);
    } catch (err) {
      const e = err as Error & { isRateLimit?: boolean; retryAfterMs?: number };
      if (e.isRateLimit) {
        // Wait the exact time the API specified, then try next model
        await new Promise(resolve => setTimeout(resolve, e.retryAfterMs ?? 65000));
        continue;
      }
      throw err;
    }
  }

  throw new Error('Transcription quota exceeded on all models. Please wait a minute and try again.');
}
