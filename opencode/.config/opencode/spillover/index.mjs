import { Plugin } from '@opencode/plugin';
import { readFileSync } from 'node:fs';

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

export default Plugin.define({
  id: 'local.spillover',
  async setup(ctx) {
    const token = readFileSync(new URL('./token', import.meta.url), 'utf8').trim();
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
    // /verify — cloud-backed correctness check of the current session's work.
    // Addresses the silent-failure gap: local models often pass their own weak
    // tests while still violating the spec (e.g. sorting map keys, ignoring a
    // flag). This sends a cheap one-shot review to the cloud build router and
    // replays its verdict into the session, so the local model can fix issues
    // without a full cloud rebuild.
    // ---------------------------------------------------------------------
    await ctx.command.transform(editor => editor.add({
      name: 'verify',
      description: 'Run a cloud correctness review of the current session against its acceptance criteria',
      execute: async ({ sessionID, prompt }) => {
        const messages = await ctx.session.context({ sessionID });
        const criteria = prompt.text.trim() || 'the task specified at the start of this session';
        const recent = messages.slice(-8).map(m => {
          const text = (m.content || []).map(p => (p.text || '')).filter(Boolean).join('\n');
          return text ? text.slice(0, 4000) : '';
        }).filter(Boolean).join('\n\n---\n\n');
        if (!recent) throw new Error('No recent session text to verify.');
        const review = await ctx.experimental.generate.text({
          model: { providerID: 'openrouter', id: 'router/build' },
          prompt: `You are reviewing the recent work of a local coding agent. Acceptance criteria: ${criteria}\n\nRecent session transcript:\n${recent}\n\nAnswer compactly: (1) VERDICT: PASS or FAIL. (2) If FAIL, list each unmet acceptance criterion with a one-line reason and the file/line if visible. (3) The single most important fix to make first. Do not write code, just the verdict and specific issues.`,
        });
        await ctx.session.synthetic({ sessionID, text: `[verify] Cloud review of "${criteria}":\n${review.text}` });
      },
    }));
  },
});
