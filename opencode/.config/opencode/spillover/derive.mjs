// derive.mjs — turn the user's own request into checkable acceptance criteria,
// so nobody has to write them by hand for the judge.
//
// Derivation always runs on a small LOCAL model through Ollama directly (the
// same bypass-the-gateway approach the judge uses), in every preset: the
// request text never leaves the machine at this step. It never throws; on any
// failure it falls back to one criterion built from the request itself.

const OLLAMA_CHAT = 'http://127.0.0.1:11434/api/chat';
export const DERIVE_MODEL = 'llama3.2:3b';
export const DERIVE_TIMEOUT_MS = 30000;

// Checks that apply to any piece of work. They are phrased so they can be
// answered from the transcript and tool output alone.
export const GENERIC_CRITERIA = [
  'Every build, test or vet command that was run in the session finished without errors, and no failing output was left unaddressed.',
  "Each claim in the assistant's final message is supported by the tool output or file changes shown.",
];

const isUser = m => m && (m.type === 'user' || m.role === 'user');

// The task as the user stated it: the first real request, plus the latest
// follow-up when there is one. Slash commands are not requests.
export function extractRequest(messages) {
  const users = (messages || [])
    .filter(m => isUser(m) && typeof m.text === 'string' && m.text.trim() && !/^\/\w/.test(m.text.trim()))
    .map(m => m.text.trim());
  if (!users.length) return '';
  const first = users[0].slice(0, 3000);
  const last = users.length > 1 ? users[users.length - 1].slice(0, 1500) : '';
  return last ? `${first}\n\nFollow-up request:\n${last}` : first;
}

export function fallbackCriteria(request) {
  return [`The work fulfils this request: ${String(request).replace(/\s+/g, ' ').trim().slice(0, 400)}`];
}

export async function deriveCriteria({ request, model = DERIVE_MODEL, fetchImpl = fetch }) {
  const fallback = fallbackCriteria(request);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DERIVE_TIMEOUT_MS);
  try {
    const response = await fetchImpl(OLLAMA_CHAT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        format: 'json',
        options: { temperature: 0 },
        messages: [
          {
            role: 'system',
            content: 'You turn a software task request into acceptance criteria. Output JSON only: {"criteria": ["...", "..."]}. Give at most 5 criteria. Each one must be a single concrete statement that can be checked as true or false by reading the code, the file changes or the command output. Use only requirements the request actually states or directly implies. Do not invent requirements. Do not use placeholders.',
          },
          { role: 'user', content: request },
        ],
      }),
    });
    if (!response.ok) return fallback;
    const body = await response.json();
    const parsed = JSON.parse(body?.message?.content ?? '');
    const list = (Array.isArray(parsed?.criteria) ? parsed.criteria : [])
      .filter(s => typeof s === 'string')
      .map(s => s.replace(/\s+/g, ' ').trim())
      .filter(s => s.length >= 8 && !/<[^>]+>/.test(s))
      .slice(0, 5);
    return list.length ? list : fallback;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}