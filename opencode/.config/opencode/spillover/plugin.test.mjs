import { test } from 'node:test';
import assert from 'node:assert/strict';
import plugin, { profileFor } from './index.mjs';

test('children inherit root privacy policy, never their own profile name', async () => {
  const sessions = { child: { parentID: 'root', agent: 'build-cloud' }, root: { agent: 'build-local' } };
  const ctx = { session: { get: async ({ sessionID }) => sessions[sessionID] } };
  assert.equal(await profileFor(ctx, 'child'), 'local');
  sessions.root.agent = 'build-mixed'; assert.equal(await profileFor(ctx, 'child'), 'mixed');
  sessions.root.agent = 'plan-cloud'; assert.equal(await profileFor(ctx, 'child'), 'cloud');
  sessions.root.agent = 'unknown'; assert.equal(await profileFor(ctx, 'child'), 'local');
});

test('plugin gates cloud requests, rewrites local requests, and disables unsafe retries', async () => {
  const hooks = {}, commands = {}, session = { agent: 'build-local' }, switches = [];
  const ctx = {
    session: {
      get: async () => session,
      hook: async (name, handler) => { hooks[name] = handler; },
      switchAgent: async x => { switches.push(x); }, switchModel: async x => { switches.push(x); },
    },
    command: { transform: async fn => fn({ add: c => { commands[c.name] = c; } }) },
    integration: { connection: { active: async () => ({}), resolve: async () => ({ type: 'key', key: 'mock-key' }) } },
  };
  await plugin.setup(ctx);
  const request = (providerID = 'ollama') => ({ sessionID: 'root', model: { providerID, id: 'llama3.2:3b' },
    request: new Request('http://127.0.0.1:11434/v1/chat/completions', { method: 'POST', body: '{}' }) });
  await assert.rejects(hooks['http.request'](request('openrouter')), /Local-only/);
  const local = request(); await hooks['http.request'](local);
  assert.equal(local.request.url, 'http://127.0.0.1:11435/v1/chat/completions');
  assert.equal(local.request.headers.get('x-spillover-mode'), 'local');
  assert.equal(local.request.headers.has('x-spillover-cloud-key'), false);
  session.agent = 'build-mixed'; const mixed = request(); await hooks['http.request'](mixed);
  assert.equal(mixed.request.headers.get('x-spillover-cloud-key'), 'mock-key');
  const retry = { model: { providerID: 'ollama' }, decision: { retry: true, delay: 100 } };
  hooks.retry(retry); assert.deepEqual(retry.decision, { retry: false });
  await commands.preset.execute({ sessionID: 'root', prompt: { text: 'mixed-build' } });
  assert.equal(switches[0].agent, 'build-mixed');
  assert.deepEqual(switches[1].model, { providerID: 'local-router', id: 'build' });
});
