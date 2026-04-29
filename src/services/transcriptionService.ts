import * as FileSystem from 'expo-file-system';

interface TranscriptionResult {
  text: string;
}

export async function transcribeAudio(
  audioUri: string,
  apiKey: string,
  language?: string
): Promise<string> {
  if (!apiKey) throw new Error('OpenAI API key is not set. Add it in Settings.');

  // Whisper API accepts m4a, mp3, mp4, mpeg, mpga, wav, webm — m4a works fine
  const formData = new FormData();
  formData.append('file', {
    uri: audioUri,
    type: 'audio/m4a',
    name: 'recording.m4a',
  } as unknown as Blob);
  formData.append('model', 'whisper-1');
  if (language) formData.append('language', language);

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      // Do NOT set Content-Type here — fetch sets it automatically with boundary
    },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `Transcription failed (${response.status})`);
  }

  const result: TranscriptionResult = await response.json();
  return result.text.trim();
}

export async function transcribeAudioFileSystem(
  audioUri: string,
  apiKey: string
): Promise<string> {
  if (!apiKey) throw new Error('OpenAI API key is not set. Add it in Settings.');

  // Alternative: read as base64 and send via fetch for environments with FormData issues
  const base64 = await FileSystem.readAsStringAsync(audioUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const boundary = 'boundary_whisper_upload';
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="model"',
    '',
    'whisper-1',
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="recording.m4a"',
    'Content-Type: audio/m4a',
    'Content-Transfer-Encoding: base64',
    '',
    base64,
    `--${boundary}--`,
  ].join('\r\n');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `Transcription failed (${response.status})`);
  }

  const result: TranscriptionResult = await response.json();
  return result.text.trim();
}
