import * as FileSystem from 'expo-file-system';

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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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
    throw new Error(err?.error?.message ?? `Transcription failed (${response.status})`);
  }

  const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error('Gemini returned an empty transcription.');
  return text;
}
