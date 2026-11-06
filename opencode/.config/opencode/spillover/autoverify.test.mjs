import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAutoverify, sessionSignature, autoverifyEnabled } from './index.mjs';
import { extractRequest, qualifyCriteria, hasDerivableRequest } from './derive.mjs';

// The autoverify factory lives in index.mjs; re-import the pieces it needs so
// the tests can stub only the boundary (verify, derive, profile, store, env).

const user = text => ({ type: 'user', text });
const assistantTool = name => ({ type: 'assistant', content: [{ type: 'tool', name, state: { input: 'x', content: [{ type: 'text', text: 'done' }] } }] });

function mkCtx({ agent = 'build', parentID, diff = [{ file: 'main.go', patch: 'x', additions: 3, deletions: 0 }] } = {}) {
  return {
    session: {
      get: async () => ({ agent, parentID }),
      context: async () => [user('add a foo function'), assistantTool('bash')],
      diff: async () => diff,
    },
  };
}

test('sessionSignature counts user turns and tool calls', () => {
  const sig = sessionSignature([user('hello'), assistantTool('bash'), user('more'), assistantTool('bash')]);
  assert.deepEqual(sig, { userTurns: 2, toolCalls: 2 });
  assert.deepEqual(sessionSignature([]), { userTurns: 0, toolCalls: 0 });
});

test('autoverifyEnabled honours SPILLOVER_AUTOVERIFY=0 and the store', () => {
  const store = { get: () => true, set: () => {} };
  assert.equal(autoverifyEnabled({}, store), true);
  assert.equal(autoverifyEnabled({}, { get: () => false }), false);
  assert.equal(autoverifyEnabled({ SPILLOVER_AUTOVERIFY: '0' }, { get: () => true }), false);
});

test('runs verify once on first idle with a diff', async () => {
  const ctx = mkCtx();
  const verifyCalls = [];
  const store = { get: () => true, set: () => {} };
  const autoverify = createAutoverify(ctx, {
    verify: async args => { verifyCalls.push(args); return { ok: true }; },
    derive: async () => ['criterion'],
    generic: [],
    profile: async () => 'local',
    store,
  });
  await autoverify({ sessionID: 's', background: [] });
  assert.equal(verifyCalls.length, 1);
  assert.ok(verifyCalls[0].criteria.length >= 1);
  assert.equal(verifyCalls[0].source, 'idle');
  assert.equal(verifyCalls[0].resume, false);
});

test('skips when background work is still running', async () => {
  const ctx = mkCtx();
  const verifyCalls = [];
  const autoverify = createAutoverify(ctx, {
    verify: async args => { verifyCalls.push(args); return { ok: true }; },
    derive: async () => ['criterion'],
    generic: [],
    profile: async () => 'local',
    store: { get: () => true, set: () => {} },
  });
  await autoverify({ sessionID: 's', background: [{ kind: 'shell', sessionID: 's', shellID: '1', command: 'ls' }] });
  assert.equal(verifyCalls.length, 0);
});

test('skips on the second idle with an unchanged signature', async () => {
  const ctx = mkCtx();
  const verifyCalls = [];
  const autoverify = createAutoverify(ctx, {
    verify: async args => { verifyCalls.push(args); return { ok: true }; },
    derive: async () => ['criterion'],
    generic: [],
    profile: async () => 'local',
    store: { get: () => true, set: () => {} },
  });
  await autoverify({ sessionID: 's', background: [] });
  await autoverify({ sessionID: 's', background: [] });
  assert.equal(verifyCalls.length, 1, 'same signature must not re-run');
});

test('skips a child session and a plan agent', async () => {
  const verifyCalls = [];
  const mk = overrides => createAutoverify(mkCtx(overrides), {
    verify: async args => { verifyCalls.push(args); return { ok: true }; },
    derive: async () => ['criterion'],
    generic: [],
    profile: async () => 'local',
    store: { get: () => true, set: () => {} },
  });
  await mk({ parentID: 'root' })({ sessionID: 'child', background: [] });
  await mk({ agent: 'plan-local' })({ sessionID: 'plan', background: [] });
  assert.equal(verifyCalls.length, 0, 'child sessions and plan agents are not graded');
});

test('skips a read-only session: tool calls but no file diff', async () => {
  // A diagnostic/planning session makes tool calls (grep, read, shell) but
  // produces no file changes. It must not be auto-graded, or the judge grades
  // the conversation itself and escalates the false FAIL to cloud.
  const ctx = {
    session: {
      get: async () => ({ agent: 'build' }),
      context: async () => [user('what mode is this?'), assistantTool('bash')],
      diff: async () => [],
    },
  };
  const verifyCalls = [];
  const autoverify = createAutoverify(ctx, {
    verify: async args => { verifyCalls.push(args); return { ok: true }; },
    derive: async () => ['criterion'],
    generic: [],
    profile: async () => 'cloud',
    store: { get: () => true, set: () => {} },
  });
  await autoverify({ sessionID: 's', background: [] });
  assert.equal(verifyCalls.length, 0, 'no file changes means nothing to grade');
});

test('stops after 3 rounds without a new user request', async () => {
  const verifyCalls = [];
  // A single autoverify instance with a mutable diff, so state persists and
  // rounds accumulate across calls (the cap lives in per-instance state).
  const diffHolder = { value: { file: 'main.go', patch: 'x', additions: 1, deletions: 0 } };
  const ctx = {
    session: {
      get: async () => ({ agent: 'build' }),
      context: async () => [user('add a foo function'), assistantTool('bash')],
      diff: async () => [diffHolder.value],
    },
  };
  const autoverify = createAutoverify(ctx, {
    verify: async args => { verifyCalls.push(args); return { ok: true }; },
    derive: async () => ['criterion'],
    generic: [],
    profile: async () => 'local',
    store: { get: () => true, set: () => {} },
  });
  for (let i = 0; i < 5; i++) {
    diffHolder.value = { file: 'main.go', patch: 'x'.repeat(i + 1), additions: i + 1, deletions: 0 };
    await autoverify({ sessionID: 's', background: [] });
  }
  assert.equal(verifyCalls.length, 3, 'cap at 3 rounds per prompt');
});

test('extractRequest returns the first request and the latest follow-up, ignoring slash commands', () => {
  const request = extractRequest([
    user('build a small cli tool'),
    user('/verify does not count'),
    user('now make it print JSON output'),
  ]);
  assert.match(request, /build a small cli tool/);
  assert.match(request, /now make it print JSON output/);
  assert.doesNotMatch(request, /\/verify/);
});

test('extractRequest ignores acknowledgements and short replies', () => {
  const request = extractRequest([
    user('integrate the judge into the flow automatically'),
    user('go'),
  ]);
  assert.equal(request, 'integrate the judge into the flow automatically');
  assert.doesNotMatch(request, /Follow-up request/);

  // With no substantive request at all, it returns empty.
  assert.equal(extractRequest([user('go'), user('/verify'), user('okay'), user('do it')]), '');
});

test('a PASS settles the session and it re-runs only on a new user request', async () => {
  const verifyCalls = [];
  const turnCount = { n: 1 };
  const ctx = {
    session: {
      get: async () => ({ agent: 'build' }),
      context: async () => [user('build the thing'), assistantTool('bash')],
      diff: async () => [{ file: 'main.go', patch: 'x', additions: 2, deletions: 0 }],
    },
  };
  const autoverify = createAutoverify(ctx, {
    derive: async () => ['criterion'],
    generic: [],
    verify: async args => { verifyCalls.push(args); return { verdict: 'PASS' }; },
    profile: async () => 'local',
    store: { get: () => true, set: () => {} },
  });

  await autoverify({ sessionID: 's', background: [] }); // 1st -> PASS, settles
  await autoverify({ sessionID: 's', background: [] }); // same userTurns -> skipped
  await autoverify({ sessionID: 's', background: [] }); // still skipped
  assert.equal(verifyCalls.length, 1, 'a PASS must settle the trail');

  // A new user request reopens the gate (simulate via a mutable transcript).
  turnCount.n = 2;
  const ctx2 = {
    session: {
      get: async () => ({ agent: 'build' }),
      context: async () => [user('build the thing'), user('now add logging'), assistantTool('bash')],
      diff: async () => [{ file: 'main.go', patch: 'y', additions: 3, deletions: 0 }],
    },
  };
  ctx.session.context = ctx2.session.context;
  ctx.session.diff = ctx2.session.diff;
  await autoverify({ sessionID: 's', background: [] });
  assert.equal(verifyCalls.length, 2, 'a new request reopens the gate');
});

test('idle falls back to generic-only criteria when the request is underivable', async () => {
  // A short user turn ("go") and no concrete request: derivation must be
  // skipped entirely and only the generic checks used — otherwise the small
  // model invents criteria ("is the request a valid HTTP request").
  const ctx = {
    session: {
      get: async () => ({ agent: 'build' }),
      context: async () => [user('go'), assistantTool('bash')],
      diff: async () => [{ file: 'main.go', patch: 'x', additions: 2, deletions: 0 }],
    },
  };
  const deriveCalls = [];
  const verifyCalls = [];
  const autoverify = createAutoverify(ctx, {
    derive: async args => { deriveCalls.push(args); return ['hallucinated']; },
    generic: ['generic-one', 'generic-two'],
    verify: async args => { verifyCalls.push(args); return { ok: true }; },
    profile: async () => 'local',
    store: { get: () => true, set: () => {} },
  });
  await autoverify({ sessionID: 's', background: [] });
  assert.equal(deriveCalls.length, 0, 'must not call the derivation model for a vague request');
  assert.equal(verifyCalls.length, 1);
  assert.deepEqual(verifyCalls[0].criteria, ['generic-one', 'generic-two']);
});

test('hasDerivableRequest rejects short and vague requests', () => {
  assert.equal(hasDerivableRequest('integrate the judge into the flow'), true);
  assert.equal(hasDerivableRequest('do it'), false);
  assert.equal(hasDerivableRequest('go'), false);
  assert.equal(hasDerivableRequest(''), false);
  assert.equal(hasDerivableRequest('make it work please'), true);
});

test('qualifyCriteria rejects boilerplate and meta-noise, falls back to the request', () => {
  const request = 'integrate the judge into the flow automatically';
  // Generic stand-in subjects and echo-of-the-prompt noise are dropped.
  const dropped = qualifyCriteria([
    'The function returns a value',
    'The function is called at least once',
    'Verify that the request outputs JSON only',
    'Confirm that the program produces the specified JSON data',
  ], request);
  assert.equal(dropped.length, 1);
  assert.match(dropped[0], /integrate the judge into the flow automatically/);

  // Concrete, request-specific criteria survive.
  const kept = qualifyCriteria([
    'jsonfmt rejects trailing data after the first JSON value',
    'jsonfmt prints a one-line error to stderr',
  ], 'make jsonfmt reject trailing data');
  assert.equal(kept.length, 2);
});