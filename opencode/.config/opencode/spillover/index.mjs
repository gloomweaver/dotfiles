import { Plugin } from '@opencode/plugin';
import { readFileSync } from 'node:fs';
import { judgeLocal, noul, renderVerdictForCloud } from './judge.mjs';
import { composeVerdict, formatVerdict } from './verdict.mjs';
import { appendRun } from './runlog.mjs';
import { deriveCriteria, extractRequest, GENERIC_CRITERIA, fallbackCriteria, hasDerivableRequest } from './derive.mjs';

export async function profileFor(ctx, sessionID) {
  const seen = new Set();
  while (sessionID && !seen.has(sessionID)) {
    seen.add(sessionID);
    const session = await ctx.session.get({ sessionID });
    // The root session owns privacy policy, not a child agent's name.
    if (session.parentID) { sessionID = session.parentID; continue; }
    if (session.agent?.endsWith('-cloud')) return 'cloud';
    if (session.agent?.endsWith('-mixed')) return 'mixed';
    if (session.agent?.endsWith('-local')) return 'local';
    // Preserve an explicit cloud model choice in existing default-agent sessions.
    if (['build', 'plan'].includes(session.agent) && session.model?.providerID === 'openrouter') return 'cloud';
    return 'local'; // Fail closed for defaults and unknown profiles.
  }
  return 'local';
}

// /verify is a factory (not a closure over module singletons) so tests can inject
// a stubbed judge, run log and profile, and so the plugin registration stays a
// one-liner. Local preset never escalates; cloud/mixed escalate on non-PASS or
// judge uncertainty.
// Flatten one stored session message into its textual evidence. The message
// shapes are heterogeneous: user messages carry top-level `text`; assistant
// messages carry `content` (text / reasoning / tool) parts; tool results live
// under `state.content` — not the message's `content` array. Reading only
// `content[].text` silently drops user turns and tool output, so this helper
// handles every shape and returns them in order.
export function collectTranscript(messages) {
  const out = [];
  for (const m of messages || []) {
    const parts = [];
    if (typeof m.text === 'string' && m.text.trim()) parts.push(m.text);
    for (const p of m.content || []) {
      if (p.type === 'text' || p.type === 'reasoning') { if (typeof p.text === 'string' && p.text.trim()) parts.push(p.text); }
      else if (p.type === 'tool') {
        const st = p.state || {};
        if (typeof st.input === 'string') parts.push(`tool input: ${st.input}`);
        else if (st.input) parts.push(`tool input: ${JSON.stringify(st.input)}`);
        for (const c of st.content || []) if (c.type === 'text' && c.text) parts.push(c.text);
        if (st.error?.message) parts.push(`tool error: ${st.error.message}`);
      }
    }
    if (parts.length) out.push(parts.join('\n'));
  }
  return out;
}

// Normalize an acceptance-criteria payload into a list of clean lines, or
// throw when nothing usable is given. Accepts either the raw command text or an
// already-derived list of criteria.
export function normalizeCriteria(criteria) {
  const lines = (Array.isArray(criteria) ? criteria : String(criteria ?? '').replace(/^["']|["']$/g, '').split('\n'))
    .map(s => typeof s === 'string' ? s.trim() : '')
    .filter(s => s && !/<[^>]+>/.test(s));
  if (!lines.length) throw new Error('No acceptance criteria to verify against: provide them explicitly, or supply a request from which they can be derived.');
  return lines;
}

export function createVerify(ctx, deps = {}) {
  const { judge = judgeLocal, append = appendRun, profile = id => profileFor(ctx, id) } = deps;
  return async ({ sessionID, prompt, criteria, resume = false, source = '' }) => {
    const messages = await ctx.session.context({ sessionID });
    const lines = normalizeCriteria(criteria ?? prompt?.text);
    const firstLine = lines[0];
    await ctx.session.synthetic({ sessionID, text: `[verify] Reviewing "${firstLine}" (${lines.length} criteria; judge will escalate to cloud if uncertain)…` });

    // Evidence: the stored transcript (prose + tool output) plus the session's
    // file diff. ctx.session.diff returns { file, patch, additions, deletions }
    // when the host can produce one; it answers the "no file/line visible"
    // complaint that a prose-only feed causes.
    const transcript = collectTranscript(messages);
    let diff = '';
    try { diff = await ctx.session.diff({ sessionID }); } catch { diff = undefined; }
    let diffText = '';
    if (Array.isArray(diff) && diff.length) {
      diffText = diff.map(d => `--- ${d.file} (+${d.additions}/-${d.deletions})\n${d.patch}`).join('\n\n');
    }

    const evidence = [
      diffText && `Files changed:\n${diffText}`,
      `Recent session transcript:\n${transcript.slice(-16).join('\n\n---\n\n')}`,
    ].filter(Boolean).join('\n\n====\n\n');
    if (!evidence.trim()) throw new Error('No session evidence to verify: the transcript and file diff are both empty.');

    const questions = {};
    lines.forEach((line, i) => {
      questions[`rule_${i + 1}`] = {
        ...noul(
          `Does the work satisfy this acceptance criterion? "${line}"`,
          { true: 'the criterion is met', false: 'the criterion is unmet or violated' },
        ),
        intent: 'satisfied',
      };
    });

    const criteriaText = lines.join('\n');
    const preset = await profile(sessionID);
    const local = await judge({ state: `Acceptance criteria:\n${criteriaText}\n\n${evidence}`, questions });

    // The local judge returns { uncertain } on transport/schema failure or
    // { answers } on success. Compose a verdict from probabilities only when
    // it actually answered.
    let verdict;
    let probabilities;
    if (local.uncertain) {
      verdict = { verdict: 'UNCERTAIN', failures: [], uncertain: Object.keys(questions) };
    } else {
      verdict = composeVerdict(questions, local.answers);
      probabilities = {};
      for (const [name, a] of Object.entries(local.answers)) {
        if (a?.type === 'noul' && Number.isFinite(a.noul)) probabilities[name] = a.noul;
      }
    }

    // Auto-run (source === 'idle') never escalates to cloud: the trigger is the
    // machine grading its own idle trail, and letting that spend OpenRouter
    // credits turned every false-positive FAIL into a paid cloud call. Cloud
    // escalation remains an explicit /verify (and manual) path only.
    const escalate = verdict.verdict !== 'PASS' && preset !== 'local' && source !== 'idle';
    // The failed criteria use the human's own words (not rule_1), so the
    // assistant — and the cloud reviewer — see exactly what the work must fix.
    const failedText = verdict.failures.map(name => lines[Number(name.slice(5)) - 1] ?? `check ${name}`).join('\n- ');
    const verdictText = formatVerdict({ ...verdict, backend: 'local', escalated: false })
      + (verdict.failures.length ? `\n[verify] Unmet:\n- ${failedText}` : '');

    if (escalate) {
      const cloudPrompt = local.uncertain
        ? `You are the fallback reviewer. The local typed judge could not answer. Acceptance criteria:\n${criteriaText}\n\n${evidence}\n\nAnswer compactly: (1) VERDICT: PASS or FAIL. (2) If FAIL, list each unmet acceptance criterion with a one-line reason and the file/line if visible. (3) The single most important fix to make first. Do not write code.`
        : `You are the fallback reviewer. The local typed judge returned ${verdict.verdict}. Local probabilities:\n${renderVerdictForCloud({ questions, answers: local.answers, state: `Acceptance criteria:\n${criteriaText}\n\n${evidence}` })}\n\nRe-evaluate: (1) VERDICT: PASS or FAIL. (2) If FAIL, list each unmet acceptance criterion with a one-line reason and the file/line if visible. (3) The single most important fix. Do not write code.`;
      const review = await ctx.experimental.generate.text({
        model: { providerID: 'openrouter', id: 'router/build' },
        prompt: cloudPrompt,
      });
      await ctx.session.synthetic({ sessionID, text: `[verify] Cloud review of "${firstLine}":\n${review.text}`, resume });
    } else {
      await ctx.session.synthetic({ sessionID, text: verdictText, resume });
    }

    // Record the run for later (not yet) routing decisions. `reason` records a
    // judge transport/schema failure; `probabilities` records the raw local
    // P(true) per check so UNCERTAIN causes are distinguishable later.
    await append({
      task: firstLine,
      preset,
      source,
      model: preset === 'local' ? 'ollama/flint:40b'
        : preset === 'mixed' ? 'local-router/build'
        : `openrouter/router/build`,
      verdict: verdict.verdict,
      failures: verdict.failures,
      uncertain: verdict.uncertain,
      escalated: escalate,
      turns: transcript.length,
      reason: local.reason,
      probabilities,
    });
    return { verdict: verdict.verdict, failures: verdict.failures, uncertain: verdict.uncertain, escalated: escalate };
  };
}

// Count the user turns and tool calls in the stored transcript; both are read
// without relying on the assistant's own prose, so the judge's own synthetic
// messages can never change the signature.
export function sessionSignature(messages) {
  let userTurns = 0;
  let toolCalls = 0;
  for (const m of messages || []) {
    if ((m.type === 'user' || m.role === 'user') && typeof m.text === 'string' && m.text.trim()) userTurns += 1;
    for (const p of m.content || []) if (p.type === 'tool') toolCalls += 1;
  }
  return { userTurns, toolCalls };
}

function diffSignature(diff) {
  if (!Array.isArray(diff) || !diff.length) return '';
  return diff
    .map(d => `${d.file}:${d.additions ?? 0}/${d.deletions ?? 0}:${(d.patch || '').length}`)
    .sort()
    .join('|');
}

export function autoverifyEnabled(env, store) {
  if (env?.SPILLOVER_AUTOVERIFY === '0') return false;
  return store.get() !== false;
}

export function createAutoverify(ctx, deps = {}) {
  const {
    verify = createVerify(ctx, deps),
    derive = deriveCriteria,
    requestOf = extractRequest,
    generic = GENERIC_CRITERIA,
    profile = id => profileFor(ctx, id),
    env = process.env,
    store = defaultStore(),
  } = deps;

  const state = new Map(); // sessionID -> { signature, rounds, running }

  return async ({ sessionID, background }) => {
    if (background && background.length) return; // hook re-fires when its own work finishes
    if (!autoverifyEnabled(env, store)) return;

    const slot = state.get(sessionID) ?? { signature: '', rounds: 0, running: false };
    if (slot.running) return;
    if (slot.settled) {
      // A previous verdict was a PASS. Only a new user request reopens the gate.
      const current = await ctx.session.context({ sessionID });
      const { userTurns } = sessionSignature(current);
      if (userTurns === slot.userTurns) return;
      slot.settled = false;
    }
    slot.running = true;
    state.set(sessionID, slot);

    try {
      const session = await ctx.session.get({ sessionID });
      if (session.parentID) return;                              // never grade a subagent
      if ((session.agent ?? '').startsWith('plan')) return;      // planning is not the deliverable

      const preset = await profile(sessionID);
      const messages = await ctx.session.context({ sessionID });
      const request = requestOf(messages);

      let diff;
      try { diff = await ctx.session.diff({ sessionID }); } catch { diff = undefined; }
      const { userTurns, toolCalls } = sessionSignature(messages);
      const sig = `${diffSignature(diff)}|${userTurns}|${toolCalls}`;

      if (sig === slot.signature) return;                        // nothing changed
      const requestChanged = userTurns !== (slot.userTurns ?? userTurns);
      const rounds = requestChanged ? 0 : slot.rounds;           // a new prompt resets the cap
      if (rounds >= 3) return;                                   // stop revising the same trail
      if (!diff?.length) return;                                 // no file changes: nothing deliverable to grade
      if (toolCalls === 0) return;                               // no work done yet

      // Derive only when the request is substantial; a short/vague request
      // hands the small derivation model a blank it fills with hallucinations
      // ("the request is a valid HTTP request"). Grade with the generic checks
      // alone when there is nothing concrete to derive from.
      const derived = hasDerivableRequest(request) ? await derive({ request }) : [];
      const criteria = [...derived, ...generic];
      let result;
      try {
        result = await verify({ sessionID, criteria, resume: false, source: 'idle' });
        slot.signature = sig;
        slot.rounds = rounds + 1;
        slot.userTurns = userTurns;
        // A PASS means the work is done: do not re-grade this trail until the
        // user sends a new request (userTurns changes). Without this, the
        // judge's own turns grow toolCalls and the hook re-fires forever.
        if (result?.verdict === 'PASS') slot.settled = true;
      } catch (error) {
        // A failed verify must never take the session down; leave the state
        // unchanged so the next idle can try again.
        if (error?.message?.includes('criteria')) { slot.signature = sig; slot.userTurns = userTurns; }
        return;
      }
      return result;
    } catch {
      return; // the idle hook must never throw and crash the session
    } finally {
      slot.running = false;
    }
  };
}

function defaultStore() {
  let value = true;
  return {
    get: () => value,
    set: v => { value = v; },
  };
}

export default Plugin.define({
  id: 'local.spillover',
  async setup(ctx) {
    const token = readFileSync(new URL('./token', import.meta.url), 'utf8').trim();
    const autoverifyStore = defaultStore();
    await ctx.session.hook('http.request', async event => {
      const profile = await profileFor(ctx, event.sessionID);
      if (profile === 'local' && !['ollama', 'local-router'].includes(event.model.providerID)) {
        throw new Error('Local-only preset blocks cloud model requests. Use /preset mixed-build or /preset cloud-build to allow cloud.');
      }
      if (!['ollama', 'local-router'].includes(event.model.providerID)) return;
      const url = new URL(event.request.url);
      // Never forward arbitrary requests or keys to an untrusted URL.
      if (url.pathname !== '/v1/chat/completions') throw new Error('Spillover requires Chat Completions');
      const headers = new Headers(event.request.headers);
      headers.set('authorization', `Bearer ${token}`);
      headers.set('x-spillover-mode', profile);
      headers.delete('x-spillover-cloud-key');
      if (profile !== 'local') {
        const connection = await ctx.integration.connection.active('openrouter');
        const credential = connection ? await ctx.integration.connection.resolve(connection) : undefined;
        if (credential?.type === 'key') headers.set('x-spillover-cloud-key', credential.key);
      }
      event.request = new Request('http://127.0.0.1:11435/v1/chat/completions', {
        method: 'POST', headers, body: event.request.body, duplex: 'half', signal: event.request.signal,
      });
    });
    await ctx.session.hook('retry', event => {
      if (['ollama', 'local-router'].includes(event.model.providerID)) event.decision = { retry: false };
    });
    await ctx.session.hook('context', async event => {
      const profile = await profileFor(ctx, event.sessionID);
      const abilities = profile === 'local' ? 'all inference must stay local, never override a child model with a cloud model.' : 'new local requests automatically spill to cloud when the slot is busy; cloud use is permitted.';
      event.system.push({ type: 'text', text: `Routing preset: ${profile}. Delegate only when useful: at most 3 independent child tasks in flight. Give each a bounded objective, relevant paths and acceptance checks; request concise findings with file/line references. Do not split trivial work. Never let concurrent workers edit overlapping files. You integrate and verify results. Local inference is serialized by a gateway; ${abilities} Planning agents must not change files or delegate implementation. Use explore for read-only discovery and general for bounded implementation in build modes. Before declaring a task done you MUST run the task's actual acceptance commands (build/test/vet and any stated examples) and paste their real, unedited output into your reply. Never write a test whose expected value merely encodes your current output; derive expectations from the specification, not from what the program happened to print. If the spec says preserve key order, verify key order explicitly.` });
    });
    // Agent selection alone does not necessarily switch the session's stored
    // model. This command explicitly changes BOTH, avoiding stale cloud/local choices.
    await ctx.command.transform(editor => editor.add({
      name: 'preset',
      description: 'Switch agent AND model: cloud-build, cloud-plan, mixed-build, mixed-plan, local-build, local-plan',
      execute: async ({ sessionID, prompt }) => {
        const match = /^(cloud|mixed|local)-(build|plan)$/.exec(prompt.text.trim());
        if (!match) throw new Error('Usage: /preset cloud-build|cloud-plan|mixed-build|mixed-plan|local-build|local-plan');
        const [, profile, mode] = match;
        const agent = `${mode}-${profile}`;
        const model = profile === 'local'
          ? { providerID: 'ollama', id: mode === 'build' ? 'flint:40b' : 'flint:40b' }
          : profile === 'mixed' && mode === 'build'
            ? { providerID: 'local-router', id: 'build' }
            : { providerID: 'openrouter', id: `router/${mode}` };
        await ctx.session.switchAgent({ sessionID, agent });
        await ctx.session.switchModel({ sessionID, model });
      },
    }));
    // ---------------------------------------------------------------------
    // /verify — typed-judge correctness check of the current session's work.
    // Addresses the silent-failure gap: local models often pass their own weak
    // tests while still violating the spec (e.g. sorting map keys, ignoring a
    // flag). A local typed decision model (autotrust-jev) grades the work first;
    // in cloud/mixed presets a non-PASS or malformed local verdict escalates to
    // the OpenRouter build router. Local preset stays local and reports
    // UNCERTAIN rather than guessing. Each run is logged to verdict.log.
    // ---------------------------------------------------------------------
    await ctx.command.transform(editor => editor.add({
      name: 'verify',
      description: 'Run a local typed-judge review of the current session, escalating to cloud when uncertain or failing',
      execute: async (input) => {
        // Bare /verify derives acceptance criteria from the user's request;
        // /verify <text> uses the explicit text. Empty text runs the derived path.
        if (input.prompt?.text?.trim()) return createVerify(ctx)({ ...input });
        const messages = await ctx.session.context({ sessionID: input.sessionID });
        const request = extractRequest(messages);
        if (!request) throw new Error('/verify needs a request to derive criteria from: ask for the work first, or pass explicit criteria.');
        const derived = hasDerivableRequest(request) ? await deriveCriteria({ request }) : [];
        const criteria = [...derived, ...GENERIC_CRITERIA];
        return createVerify(ctx)({ sessionID: input.sessionID, criteria, source: 'verify' });
      },
    }));
    await ctx.command.transform(editor => editor.add({
      name: 'autoverify',
      description: 'Toggle the automatic judge: /autoverify on|off|status',
      execute: async ({ prompt, sessionID }) => {
        const arg = (prompt.text || '').trim().toLowerCase();
        const say = text => ctx.session.synthetic({ sessionID, text });
        if (!arg || arg === 'status') return say(`Auto-verify is ${autoverifyStore.get() ? 'ON' : 'OFF'}.`);
        if (arg === 'on') { autoverifyStore.set(true); return say('Auto-verify enabled: the judge will run when each task finishes.'); }
        if (arg === 'off') { autoverifyStore.set(false); return say('Auto-verify disabled.'); }
        throw new Error('Usage: /autoverify on|off|status');
      },
    }));
    // ---------------------------------------------------------------------
    // Auto-verify — the judge runs on its own when a session finishes work,
    // with no hand-written criteria (derived from the user's request). /verify
    // without an argument uses the same derivation.
    // ---------------------------------------------------------------------
    await ctx.session.hook('experimental.idle', createAutoverify(ctx, { store: autoverifyStore }));
  },
});
