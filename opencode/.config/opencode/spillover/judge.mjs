// judge.mjs — a client for the local typed decision model (AutoTrust Jev via
// Ollama's /v1/systemone endpoint) plus a thin OpenAI-style fallback used for
// escalation to the OpenRouter build router.
//
// Jev-shaped models answer typed questions with probabilities, not free text.
// This module exposes the three question types (noul / choice / score) as plain
// helpers and always returns a well-formed result: { answers, usage, ... } or
// { uncertain: true, reason }. It never throws for transport, HTTP, parse or
// schema errors — the caller decides how to escalate.

const SYSTEMONE_URL = 'http://127.0.0.1:11434/v1/systemone';

// Two request timeouts: header (first byte) and body (whole response). Local
// decision models are fast (tens of ms to a few hundred ms); these bounds are
// generous so a swapped-in model on a loaded box still answers.
export const TIMEOUTS = { headerMs: 30000, bodyMs: 30000 };

export function noul(instructions, criteria) {
  return { type: 'noul', instructions, criteria };
}
export function choice(instructions, criteria) {
  return { type: 'choice', instructions, criteria };
}
export function score(instructions, criteria) {
  return { type: 'score', instructions, criteria };
}

// Independent standalone fetch, not the session's request context, so the plugin
// can call the judge without routing its call through the chat gateway.
const fetch_ = async (input, init) => fetch(input, init);

async function readJson(response) {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try { return JSON.parse(text); } catch { return undefined; }
}

function isRecord(value) { return value != null && typeof value === 'object' && !Array.isArray(value); }

function isNoulAnswer(value) {
  return isRecord(value) && value.type === 'noul' && typeof value.noul === 'number'
    && Number.isFinite(value.noul);
}
function isChoiceAnswer(value) {
  return isRecord(value) && value.type === 'choice' && typeof value.choice === 'string'
    && isRecord(value.probabilities)
    && Object.values(value.probabilities).every(v => typeof v === 'number' && Number.isFinite(v));
}
function isScoreAnswer(value) {
  return isRecord(value) && value.type === 'score' && typeof value.score === 'number'
    && Number.isFinite(value.score);
}

function validateAnswers(questions, answers) {
  if (!isRecord(answers)) return { ok: false, reason: 'missing or non-object answers' };
  const problems = [];
  for (const [name, q] of Object.entries(questions)) {
    const a = answers[name];
    if (a === undefined) { problems.push(`${name}: absent`); continue; }
    const ok = q.type === 'noul' ? isNoulAnswer(a)
      : q.type === 'choice' ? isChoiceAnswer(a)
      : q.type === 'score' ? isScoreAnswer(a) : false;
    if (!ok) problems.push(`${name}: malformed ${q.type} answer`);
  }
  if (problems.length) return { ok: false, reason: problems.join('; ') };
  return { ok: true };
}

function validateQuestions(questions) {
  if (!isRecord(questions) || Object.keys(questions).length === 0) {
    throw new Error('questions must be a non-empty object');
  }
  for (const [name, q] of Object.entries(questions)) {
    if (!isRecord(q) || q.type === undefined) throw new Error(`question ${name} missing type`);
    if (q.type !== 'noul' && q.type !== 'choice' && q.type !== 'score') {
      throw new Error(`question ${name} has unknown type ${String(q.type)}`);
    }
    if (typeof q.instructions !== 'string' || !q.instructions.trim()) {
      throw new Error(`question ${name} missing instructions`);
    }
    const criteria = q.criteria;
    if (q.type === 'score') {
      if (!Array.isArray(criteria) || criteria.length < 2 || criteria.length > 10
        || criteria.some(c => typeof c !== 'string')) {
        throw new Error(`question ${name} score criteria must be 2-10 strings`);
      }
    } else if (!isRecord(criteria) || Object.keys(criteria).length === 0) {
      throw new Error(`question ${name} criteria must be a non-empty object`);
    }
  }
}

function unknown(reason) { return { uncertain: true, reason }; }

async function sendSystemOne(body) {
  const controller = new AbortController();
  const header = setTimeout(() => controller.abort(), TIMEOUTS.headerMs);
  let response;
  try {
    response = await fetch_(SYSTEMONE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    return unknown(`local judge request failed: ${error.name === 'AbortError' ? 'header timeout' : error.message}`);
  } finally {
    clearTimeout(header);
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    return unknown(`local judge HTTP ${response.status}`);
  }
  let payload;
  const bodyTimer = setTimeout(() => controller.abort(), TIMEOUTS.bodyMs);
  try { payload = await readJson(response); } catch {
    return unknown('local judge body timeout');
  } finally { clearTimeout(bodyTimer); }
  if (payload === undefined) return unknown('local judge empty or non-JSON body');
  if (!isRecord(payload) || !isRecord(payload.answers)) return unknown('local judge missing answers');
  return { ok: true, payload };
}

/**
 * Ask typed questions of the local decision model.
 * @param {string} model Ollama model id (default autotrust-jev:9b-nvfp4).
 * @param {{questions: object, state: string}} args
 * @returns {{answers, usage?, model?} | {uncertain: true, reason: string}}
 */
export async function judgeLocal({ model = 'autotrust-jev:9b-nvfp4', state, questions }) {
  try { validateQuestions(questions); } catch (error) { return unknown(`bad questions: ${error.message}`); }
  if (typeof state !== 'string' || !state.trim()) return unknown('missing or empty state');
  const result = await sendSystemOne({ model, state, questions });
  if (!result.ok) return result;
  const { payload } = result;
  const check = validateAnswers(questions, payload.answers);
  if (!check.ok) return unknown(`local judge malformed answers: ${check.reason}`);
  return { answers: payload.answers, usage: payload.usage, model: payload.model };
}

/**
 * Parse a JSON-Lines run log entry. Returns undefined on any malformed line;
 * must never throw.
 */
export function parseLogLine(line) {
  const text = line == null ? '' : String(line).trim();
  if (!text) return undefined;
  if (text.startsWith('#')) return undefined;
  try {
    const value = JSON.parse(text);
    return isRecord(value) && typeof value.task === 'string' ? value : undefined;
  } catch { return undefined; }
}

// ---------------------------------------------------------------------------
// Escalation renderer: a Jev-style local answer is reformatted into the prompt
// the OpenRouter build router already expects, so one cloud path serves reviews
// of uncertain local verdicts.
// ---------------------------------------------------------------------------
export function renderVerdictForCloud({ questions, answers, state }) {
  const qList = Object.keys(questions);
  return qList
    .map(name => {
      const a = answers[name];
      if (!a) return `${name}: (no answer)`;
      if (a.type === 'noul') return `${name}: P(true)=${(100 * a.noul).toFixed(1)}%`;
      if (a.type === 'choice') {
        const top = Object.entries(a.probabilities).sort((x, y) => y[1] - x[1])[0];
        return `${name}: ${a.choice} (top=${top?.[0]} @${(100 * (top?.[1] ?? 0)).toFixed(1)}%)`;
      }
      return `${name}: score=${a.score}`;
    })
    .concat([`STATE:\n${state}`])
    .join('\n');
}