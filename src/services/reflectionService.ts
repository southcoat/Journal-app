import { JournalEntry } from '../types';

const FALLBACK_PROMPTS = [
  "What's been weighing on your mind most this week?",
  "Is there something you've been avoiding that deserves attention?",
  "What's one thing you're proud of since your last entry?",
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
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 200,
        messages: [
          {
            role: 'system',
            content:
              'You are a thoughtful journaling coach. Based on the user\'s recent journal entries, generate exactly 2-3 short, specific reflection questions to guide their next recording. Make them feel personal and connected to their actual content — not generic self-help clichés. Focus on growth, unresolved threads, or meaningful patterns you notice. Return ONLY a valid JSON array of strings, nothing else. Example: ["How did the team meeting go after you restructured it?","You mentioned feeling stuck — what\'s shifted since then?"]',
          },
          {
            role: 'user',
            content: `Recent journal entries:\n\n${transcripts}`,
          },
        ],
      }),
    });

    if (!response.ok) return pickFallbacks();

    const data = await response.json() as { choices: { message: { content: string } }[] };
    const content = data.choices?.[0]?.message?.content?.trim() ?? '';
    const parsed: unknown = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return (parsed as string[]).slice(0, 3);
    }
    return pickFallbacks();
  } catch {
    return pickFallbacks();
  }
}

function pickFallbacks(): string[] {
  const shuffled = [...FALLBACK_PROMPTS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 2);
}
