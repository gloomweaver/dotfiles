// verdict.mjs — turn raw typed judge answers into a PASS / FAIL / UNCERTAIN
// verdict and a list of failing checks.
//
// A verdict is only as good as the checks. Checks are atomic yes/no questions,
// one per acceptance criterion, each given only the evidence relevant to it.
// A `state` that dumps the entire task degrades decision models (Jev's own
// documented jaggedness), so question order in this file is intentionally
// keys in a spec list, not transcript prose.

export const THRESHOLD_FAIL = 0.7;   // P(violation) at or above => FAIL
export const THRESHOLD_PASS = 0.3;   // strictly below             => PASS

export function noulConfidence(p) { return Math.abs(2 * p - 1); }
export function choiceConfidence(probabilities) {
  const values = Object.values(probabilities || {});
  const n = values.length;
  if (n < 2) return 0;
  const max = Math.max(...values);
  return (max - 1 / n) / (1 - 1 / n);
}

// Compose raw `answers` (question name -> typed answer) into a verdict.
// `questions` carries the spec text each check was derived from.
//
// Polarity is explicit. Each check carries an `intent`:
//   'violation' — the question states a defect; noul P(true) IS P(defect).
//   'satisfied' — the question states the requirement being met; noul P(true)
//                  is P(satisfied), so P(defect) = 1 - P(true).
// Default is 'violation' so an omitted intent cannot silently flip a verdict.
export function composeVerdict(questions, answers) {
  const failures = [];
  const uncertain = [];
  for (const [name, q] of Object.entries(questions)) {
    const a = answers?.[name];
    if (!a) { uncertain.push(name); continue; }
    let p;
    const intent = q.intent ?? 'violation';
    if (q.type === 'noul') {
      const trueP = a.noul ?? a.probabilities?.true;
      if (!Number.isFinite(trueP)) { uncertain.push(name); continue; }
      p = intent === 'satisfied' ? 1 - trueP : trueP;
    } else if (q.type === 'choice' && a.probabilities?.violation !== undefined) {
      // A choice with a "violation" option is a verdict signal; other choices
      // (severity, category) are not and are treated as non-verdict evidence.
      p = a.probabilities.violation;
      if (!Number.isFinite(p)) { uncertain.push(name); continue; }
    } else {
      continue;
    }
    if (p >= THRESHOLD_FAIL) failures.push(name);
    else if (p >= THRESHOLD_PASS) uncertain.push(name);
    // else: clearly not a violation => pass
  }
  const verdict = failures.length ? 'FAIL'
    : uncertain.length ? 'UNCERTAIN'
    : 'PASS';
  return { verdict, failures, uncertain };
}

// Format a verdict for a session message. Kept here so both /verify and any
// future auto-run path produce identical text.
export function formatVerdict({ verdict, failures, uncertain, backend, escalated, reason }) {
  const lines = [];
  lines.push(`[verify] VERDICT: ${verdict}${backend ? ` (${backend})` : ''}`);
  if (escalated) lines.push(`[verify] local verdict was escalated to the cloud reviewer${reason ? `: ${reason}` : '.'}`);
  if (failures.length) lines.push(`[verify] FAILED checks: ${failures.join(', ')}`);
  if (uncertain.length) lines.push(`[verify] UNCERTAIN checks: ${uncertain.join(', ')}`);
  return lines.join('\n');
}