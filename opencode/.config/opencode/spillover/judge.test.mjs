import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';

// judge.mjs resolves SYSTEMONE_URL at module load, so we can only exercise the
// real endpoint shape here, not inject an arbitrary URL. These tests cover the
// schema validation, the uncertain-or-answer contract, and the cloud renderer
// (all unit-testable without network), plus a live call skipped unless
// SKIP_JUDGE_LIVE is unset and Ollama answers the real model.

import { composeVerdict, noulConfidence, choiceConfidence, formatVerdict } from './verdict.mjs';
import { judgeLocal, renderVerdictForCloud, parseLogLine, noul, choice, score } from './judge.mjs';

const QUESTIONS = {
  preserve_order: noul('does the output preserve input key order?', { true: 'keys stay in input order', false: 'keys are reordered' }),
  honors_indent: noul('is the -indent flag honored?', { true: 'the flag changes indentation', false: 'the flag is ignored' }),
};

test('noul/choice/score helpers build typed questions', () => {
  assert.deepEqual(noul('q', { true: 'y', false: 'n' }), { type: 'noul', instructions: 'q', criteria: { true: 'y', false: 'n' } });
  assert.deepEqual(choice('q', { a: 'x', b: 'y' }), { type: 'choice', instructions: 'q', criteria: { a: 'x', b: 'y' } });
  assert.deepEqual(score('q', ['low', 'high']), { type: 'score', instructions: 'q', criteria: ['low', 'high'] });
});

test('confidence formulas match the documented Jev derivations', () => {
  assert.equal(noulConfidence(0), 1);
  assert.equal(noulConfidence(0.5), 0);
  assert.equal(noulConfidence(0.1), 0.8);
  assert.equal(choiceConfidence({ a: 1, b: 0 }), 1);
  assert.equal(choiceConfidence({ a: 0.5, b: 0.5 }), 0);
});

test('composeVerdict: FAIL when any check reaches the fail threshold', () => {
  const v = composeVerdict(QUESTIONS, {
    preserve_order: { type: 'noul', noul: 0.9 },
    honors_indent: { type: 'noul', noul: 0.0 },
  });
  assert.equal(v.verdict, 'FAIL');
  assert.deepEqual(v.failures, ['preserve_order']);
  assert.deepEqual(v.uncertain, []);
});

test('composeVerdict: PASS only when every check is below the pass threshold', () => {
  const v = composeVerdict(QUESTIONS, {
    preserve_order: { type: 'noul', noul: 0.0 },
    honors_indent: { type: 'noul', noul: 0.05 },
  });
  assert.equal(v.verdict, 'PASS');
  assert.deepEqual(v.failures, []);
});

test('composeVerdict: satisfied intent inverts polarity, so a high P(satisfied) is a PASS', () => {
  const q = { preserve: { ...noul('does it preserve order?', { true: 'preserves', false: 'reorders' }), intent: 'satisfied' } };
  // P(satisfied)=0.95 => P(violation)=0.05 => PASS, not FAIL.
  const good = composeVerdict(q, { preserve: { type: 'noul', noul: 0.95 } });
  assert.equal(good.verdict, 'PASS');
  assert.deepEqual(good.failures, []);
  // P(satisfied)=0.05 => P(violation)=0.95 => FAIL.
  const bad = composeVerdict(q, { preserve: { type: 'noul', noul: 0.05 } });
  assert.equal(bad.verdict, 'FAIL');
  assert.deepEqual(bad.failures, ['preserve']);
});

test('composeVerdict: mid-range answer or missing answer is UNCERTAIN, never FAIL or PASS', () => {
  const v = composeVerdict(QUESTIONS, {
    preserve_order: { type: 'noul', noul: 0.5 },
    honors_indent: { type: 'noul', noul: 0.0 },
  });
  assert.equal(v.verdict, 'UNCERTAIN');
  assert.deepEqual(v.uncertain, ['preserve_order']);
});

test('judgeLocal returns uncertain on empty or malformed questions without throwing', async () => {
  assert.match((await judgeLocal({ state: 'x', questions: {} })).reason, /bad questions/);
  assert.match((await judgeLocal({ state: '', questions: QUESTIONS })).reason, /state/);
});

test('parseLogLine tolerates blanks, comments and malformed JSON', () => {
  assert.equal(parseLogLine(''), undefined);
  assert.equal(parseLogLine('# comment'), undefined);
  assert.equal(parseLogLine('not json'), undefined);
  assert.equal(parseLogLine('{"nope":1}'), undefined);
  assert.deepEqual(parseLogLine('{"task":"x","n":1}'), { task: 'x', n: 1 });
});

test('formatVerdict lists failing and uncertain checks', () => {
  const text = formatVerdict({ verdict: 'FAIL', failures: ['preserve_order'], uncertain: [], backend: 'local', escalated: false });
  assert.match(text, /VERDICT: FAIL/);
  assert.match(text, /preserve_order/);
  const unc = formatVerdict({ verdict: 'UNCERTAIN', failures: [], uncertain: ['honors_indent'], backend: 'local', escalated: false });
  assert.match(unc, /UNCERTAIN checks: honors_indent/);
});

test('renderVerdictForCloud includes per-check probabilities and state', () => {
  const out = renderVerdictForCloud({
    questions: { preserve_order: QUESTIONS.preserve_order },
    answers: { preserve_order: { type: 'noul', noul: 0.9 } },
    state: 'the evidence',
  });
  assert.match(out, /preserve_order: P\(true\)=90.0%/);
  assert.match(out, /the evidence/);
});

// Live smoke test against the real Ollama endpoint. Skips gracefully when the
// model is unavailable (e.g. CI, or Ollama not running). Set SKIP_JUDGE_LIVE=1
// to force it off.
test('live: local judge answers a trivial noul', { skip: process.env.SKIP_JUDGE_LIVE === '1' }, async () => {
  const result = await judgeLocal({
    state: 'the sky is blue',
    questions: { is_blue: noul('is the sky described as blue?', { true: 'sky is blue', false: 'sky is not blue' }) },
  });
  if (result.uncertain) {
    // A live environment without the model loaded should not fail the suite;
    // report the reason instead. Force failure only when explicitly requested.
    if (process.env.REQUIRE_JUDGE_LIVE) assert.fail(`live judge uncertain: ${result.reason}`);
    return;
  }
  assert.ok(result.answers.is_blue.noul > 0.9);
});