import { JournalEntry } from '../types';

const FALLBACK_PROMPTS = [
  "What's been weighing on your mind most this week?",
  "Is there something you've been avoiding that deserves attention?",
  "What's one thing you're proud of since your last entry?",
  "What would you do differently if you could replay the last few days?",
  "Where did your energy go today — was it where you wanted it?",
];

export async function generateReflectionPrompts(
  recentEntries: JournalEntry[],
  apiKey: string
): Promise<string[]> {
  const transcripts = recentEntries
    .filter(e => e.transcript && e.transcript.length > 50)
    .slice(0, 4)
    .map((e, i) => `Entry ${i + 1} (${new Date(e.date).toLocaleDateString()}): ${e.transcript.slice(0, 400)}`)
    .join('\n\n');

  if (!transcripts || !apiKey) return pickFallbacks();

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: "You are a thoughtful journaling coach. Based on the user's recent journal entries, generate 2 to 4 short, specific reflection questions to guide their next recording. Make them feel personal and connected to their actual content — not generic self-help clichés. Focus on growth, unresolved threads, or meaningful patterns you notice. Return ONLY a valid JSON array of strings, nothing else. Example: [\"How did the team meeting go after you restructured it?\",\"You mentioned feeling stuck — what's shifted since then?\"]",
            }],
          },
          contents: [{
            parts: [{ text: `Recent journal entries:\n\n${transcripts}` }],
          }],
          generationConfig: {
            maxOutputTokens: 300,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) return pickFallbacks();

    const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    const parsed: unknown = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return (parsed as string[]).slice(0, 4);
    }
    return pickFallbacks();
  } catch {
    return pickFallbacks();
  }
}

function pickFallbacks(): string[] {
  const count = 2 + Math.floor(Math.random() * 3); // 2, 3, or 4
  return [...FALLBACK_PROMPTS].sort(() => Math.random() - 0.5).slice(0, count);
}
