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
  'The work is in a finished state: the latest run of each build, test and vet command relevant to the final result passed, and no failing output was left uncorrected. A command that failed earlier and then passed after a fix counts as passed.',
  "Each claim in the assistant's final message is supported by the tool output or file changes shown.",
];

const isUser = m => m && (m.type === 'user' || m.role === 'user');

// A short reply ("go", "yes", "continue", "do it") is an acknowledgement, not a
// task. A derivable request carries enough words to name a subject and an
// action; anything shorter hands the 3B model a blank it fills with noise.
const isTrivial = s => {
  const words = s.split(/\s+/).filter(Boolean);
  return words.length <= 3;
};

// A request is worth deriving from when it names a concrete subject. Short,
// verb-only instructions ("do it", "go") have no subject to grade against.
export function hasDerivableRequest(request) {
  const s = String(request ?? '').trim();
  return s.length >= 12;
}

// The task as the user stated it: the first real request, plus the latest
// substantive follow-up when there is one. Slash commands, acknowledgements and
// short replies are not requests.
export function extractRequest(messages) {
  const users = (messages || [])
    .filter(m => isUser(m) && typeof m.text === 'string' && m.text.trim() && !/^\/\w/.test(m.text.trim()) && !isTrivial(m.text.trim()))
    .map(m => m.text.trim());
  if (!users.length) return '';
  const first = users[0].slice(0, 3000);
  const last = users.length > 1 ? users[users.length - 1].slice(0, 1500) : '';
  return last ? `${first}\n\nFollow-up request:\n${last}` : first;
}

export function fallbackCriteria(request) {
  return [`The work fulfils this request: ${String(request).replace(/\s+/g, ' ').trim().slice(0, 400)}`];
}

// A criterion is only useful if it names the request's actual subject, not a
// generic stand-in. A small local model tends to convert "integrate X into the
// flow" into "a function returns a string" — pure boilerplate that grades the
// wrong thing. These filters reject that so the judge falls back to a
// request-anchored criterion instead of inventing requirements.
const BOILERPLATE = /\b(the )?(function|code|the program|the app|it|this)\b (returns|is called|does not throw|throws|works|runs|handles|produces)/i;
// Meta-noise: a small model echoes the derivation prompt's own "output JSON
// only" phrasing back as if it were a requirement of the task.
const META_NOISE = /\b(output(?:s)? (json|only)|json (format|only)|produces? (the )?(output|json)|extraneous data|specified (json|data)|matches? the format)\b/i;

function isSpecific(line) {
  const words = line.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  // Reject one-word or near-empty statements and boilerplate subject templates
  // and echo-of-the-prompt noise.
  if (words.length < 4) return false;
  if (BOILERPLATE.test(line)) return false;
  if (META_NOISE.test(line)) return false;
  return true;
}

export function qualifyCriteria(list, request) {
  const cleaned = (Array.isArray(list) ? list : [])
    .filter(s => typeof s === 'string')
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(s => s.length >= 8 && !/<[^>]+>/.test(s) && isSpecific(s))
    .slice(0, 5);
  return cleaned.length ? cleaned : fallbackCriteria(request);
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
            content: 'You are a criteria extractor. Your whole reply must be a JSON object with one key "criteria" whose value is an array of strings. Do not describe your formatting; write only that JSON object.\n\nRules for the strings:\n1. Reuse the concrete nouns, flags, file names, functions and behaviours the request actually names.\n2. Each string is a single behaviour that is checkable as true or false from the code, file changes or command output.\n3. Never invent requirements the request does not state or directly imply.\n4. Never write a criterion about "a function" returning a value or being called unless the request names that specific function and that behaviour. Never paraphrase the request as "the program produces output".\n5. If the request names no concrete behaviour, return one criterion that restates the request as the target.',
          },
          { role: 'user', content: request },
        ],
      }),
    });
    if (!response.ok) return fallback;
    const body = await response.json();
    const parsed = JSON.parse(body?.message?.content ?? '');
    return qualifyCriteria(parsed?.criteria, request);
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}