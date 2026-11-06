import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVerify } from './index.mjs';

// Stubbed session with one user turn so there is always "recent" text.
const messages = [{ role: 'user', content: [{ type: 'text', text: 'did the work' }] }];

function makeCtx(preset) {
  const calls = { synthetic: [], generate: [] };
  const ctx = {
    session: {
      context: async () => messages,
      synthetic: async args => { calls.synthetic.push(args.text); },
    },
    experimental: { generate: { text: async args => { calls.generate.push(args); return ({ text: 'CLOUD REVIEW' }); } } },
  };
  return { ctx, calls };
}

// noul answers are { type:'noul', noul: pTrue }. With intent 'satisfied',
// P(defect) = 1 - pTrue. So noul: 0.95 => P(defect)=0.05 => PASS; noul: 0.05 => FAIL.
const passAnswer = () => ({ type: 'noul', noul: 0.95 });
const failAnswer = () => ({ type: 'noul', noul: 0.05 });

test('PASS stays local and does not escalate', async () => {
  const { ctx, calls } = makeCtx('local');
  const judge = async () => ({ answers: { rule_1: passAnswer() } });
  const appended = [];
  const verify = createVerify(ctx, { judge, profile: async () => 'local', append: async r => appended.push(r) });
  await verify({ sessionID: 's', prompt: { text: 'the test passes' } });
  assert.equal(calls.generate.length, 0, 'no cloud call');
  assert.equal(calls.synthetic.length, 2, 'reviewing + verdict message');
  assert.match(calls.synthetic[0], /^\[verify\] Reviewing/);
  assert.match(calls.synthetic[1], /VERDICT: PASS/);
  assert.equal(appended.length, 1);
  assert.equal(appended[0].verdict, 'PASS');
  assert.equal(appended[0].escalated, false);
});

test('FAIL in local preset never escalates, stays local', async () => {
  const { ctx, calls } = makeCtx('local');
  const judge = async () => ({ answers: { rule_1: failAnswer() } });
  const appended = [];
  const verify = createVerify(ctx, { judge, profile: async () => 'local', append: async r => appended.push(r) });
  await verify({ sessionID: 's', prompt: { text: 'must not ignore --indent' } });
  assert.equal(calls.generate.length, 0, 'local preset must not call cloud');
  assert.equal(appended[0].verdict, 'FAIL');
  assert.equal(appended[0].escalated, false);
});

test('FAIL in mixed preset escalates to the cloud reviewer', async () => {
  const { ctx, calls } = makeCtx('mixed');
  const judge = async () => ({ answers: { rule_1: failAnswer() } });
  const appended = [];
  const verify = createVerify(ctx, { judge, profile: async () => 'mixed', append: async r => appended.push(r) });
  await verify({ sessionID: 's', prompt: { text: 'must not ignore --indent' } });
  assert.equal(calls.generate.length, 1, 'mixed preset escalates on FAIL');
  assert.equal(calls.generate[0].model.id, 'router/build');
  // failAnswer noul=0.05 with intent 'satisfied' => P(defect)=0.95, above threshold.
  assert.match(calls.generate[0].prompt, /rule_1: P\(true\)=5\.0%/);
  assert.equal(appended[0].escalated, true);
  assert.equal(appended[0].verdict, 'FAIL');
});

test('judge uncertain in local preset reports UNCERTAIN without escalation', async () => {
  const { ctx, calls } = makeCtx('local');
  const judge = async () => ({ uncertain: true, reason: 'offline' });
  const appended = [];
  const verify = createVerify(ctx, { judge, profile: async () => 'local', append: async r => appended.push(r) });
  await verify({ sessionID: 's', prompt: { text: 'some criteria' } });
  assert.equal(calls.generate.length, 0, 'local preset must not escalate');
  assert.match(calls.synthetic[1], /VERDICT: UNCERTAIN/);
  assert.equal(appended[0].verdict, 'UNCERTAIN');
  assert.equal(appended[0].escalated, false);
  assert.equal(appended[0].reason, 'offline');
});

test('judge uncertain in mixed preset escalates to cloud', async () => {
  const { ctx, calls } = makeCtx('mixed');
  const judge = async () => ({ uncertain: true, reason: 'offline' });
  const appended = [];
  const verify = createVerify(ctx, { judge, profile: async () => 'mixed', append: async r => appended.push(r) });
  await verify({ sessionID: 's', prompt: { text: 'some criteria' } });
  assert.equal(calls.generate.length, 1, 'mixed preset escalates when judge is uncertain');
  assert.equal(appended[0].verdict, 'UNCERTAIN');
  assert.equal(appended[0].escalated, true);
});

test('empty criteria throws', async () => {
  const { ctx } = makeCtx('local');
  const verify = createVerify(ctx, { judge: async () => ({ answers: {} }), profile: async () => 'local' });
  await assert.rejects(() => verify({ sessionID: 's', prompt: { text: '   ' } }), /requires acceptance criteria/);
});

test('placeholder criteria throws before the judge runs', async () => {
  const { ctx, calls } = makeCtx('local');
  let judged = false;
  const verify = createVerify(ctx, { judge: async () => { judged = true; return { answers: {} }; }, profile: async () => 'local' });
  await assert.rejects(() => verify({ sessionID: 's', prompt: { text: '<criteria>' } }), /placeholder/);
  assert.equal(judged, false, 'judge must not be called on placeholder criteria');
  assert.equal(calls.synthetic.length, 0, 'no reviewing message when criteria are invalid');
});

test('surrounding quotes are stripped from criteria', async () => {
  const { ctx } = makeCtx('local');
  const judge = async () => ({ answers: { rule_1: passAnswer() } });
  const appended = [];
  const verify = createVerify(ctx, { judge, profile: async () => 'local', append: async r => appended.push(r) });
  await verify({ sessionID: 's', prompt: { text: '"must pass the tests"' } });
  assert.equal(appended[0].task, 'must pass the tests');
});

test('append records verdict, failures, uncertain, escalated, turns, probability', async () => {
  const { ctx } = makeCtx('cloud');
  const judge = async () => ({ answers: { rule_1: failAnswer() } });
  const appended = [];
  const verify = createVerify(ctx, { judge, profile: async () => 'cloud', append: async r => appended.push(r) });
  await verify({ sessionID: 's', prompt: { text: 'must not ignore --indent' } });
  assert.equal(appended.length, 1);
  const r = appended[0];
  assert.equal(r.verdict, 'FAIL');
  assert.deepEqual(r.failures, ['rule_1']);
  assert.deepEqual(r.uncertain, []);
  assert.equal(r.escalated, true);
  assert.equal(r.turns, messages.length);
  assert.equal(r.model, 'openrouter/router/build');
  assert.deepEqual(r.probabilities, { rule_1: 0.05 });
});