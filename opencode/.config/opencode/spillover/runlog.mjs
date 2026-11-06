// runlog.mjs — append-only JSONL log of judge verdicts, keyed by task. This is
// the evidence base for later model routing, not a routing decision today.
//
// One line per /verify run: { ts, task, preset, model, verdict, failures,
// uncertain, escalated, turns, cost }. Cost is optional and only present when
// the caller can attribute spending (OpenCode's own attribution is unreliable
// for overflow; treat it as an estimate and prefer the OpenRouter dashboard).

import { appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export function logPath() { return fileURLToPath(new URL('./verdict.log', import.meta.url)); }

function isRecord(value) { return value != null && typeof value === 'object' && !Array.isArray(value); }

export async function appendRun(entry) {
  const record = {
    ts: new Date().toISOString(),
    task: String(entry?.task ?? '').slice(0, 200),
    preset: String(entry?.preset ?? 'local'),
    source: entry?.source != null ? String(entry.source) : 'verify',
    model: String(entry?.model ?? ''),
    verdict: String(entry?.verdict ?? 'UNCERTAIN'),
    failures: Array.isArray(entry?.failures) ? entry.failures : [],
    uncertain: Array.isArray(entry?.uncertain) ? entry.uncertain : [],
    escalated: !!entry?.escalated,
    turns: Number.isFinite(entry?.turns) ? entry.turns : undefined,
    reason: entry?.reason != null ? String(entry.reason) : undefined,
    probabilities: isRecord(entry?.probabilities) ? entry.probabilities : undefined,
    cost: Number.isFinite(entry?.cost) ? entry.cost : undefined,
  };
  await appendFile(logPath(), JSON.stringify(record) + '\n', 'utf8');
  return record;
}