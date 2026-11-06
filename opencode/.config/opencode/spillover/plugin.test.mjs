import test from 'node:test';
import assert from 'node:assert/strict';
import plugin, { modeFor } from './index.mjs';

test('mode follows the model provider', () => {
  assert.equal(modeFor('local-router'), 'mixed');
  assert.equal(modeFor('ollama'), 'local');
  assert.equal(modeFor('openrouter'), undefined);
  assert.equal(modeFor(undefined), undefined);
});

async function setup({ connection = { id: 'c1' }, credential = { type: 'key', key: 'sk-or-test' } } = {}) {
  const hooks = {};
  const ctx = {
    session: { hook: async (name, fn) => { hooks[name] = fn; } },
    integration: { connection: {
      active: async () => connection,
      resolve: async () => credential,
    } },
  };
  await plugin.setup(ctx);
  return hooks;
}

const make = (providerID, path = '/v1/chat/completions') => ({
  model: { providerID },
  request: new Request(`http://127.0.0.1:11434${path}`, {
    method: 'POST', headers: { 'x-spillover-cloud-key': 'stale' }, body: '{}',
  }),
});

test('local-router: mixed mode, forwards the OpenRouter key to the gateway', async () => {
  const hooks = await setup();
  const event = make('local-router');
  await hooks['http.request'](event);
  assert.equal(event.request.url, 'http://127.0.0.1:11435/v1/chat/completions');
  assert.equal(event.request.headers.get('x-spillover-mode'), 'mixed');
  assert.equal(event.request.headers.get('x-spillover-cloud-key'), 'sk-or-test');
  assert.match(event.request.headers.get('authorization'), /^Bearer .+/);
});

test('ollama: local mode, never carries a cloud key', async () => {
  const hooks = await setup();
  const event = make('ollama');
  await hooks['http.request'](event);
  assert.equal(event.request.headers.get('x-spillover-mode'), 'local');
  assert.equal(event.request.headers.get('x-spillover-cloud-key'), null);
});

test('openrouter requests are left untouched', async () => {
  const hooks = await setup();
  const event = make('openrouter');
  const before = event.request;
  await hooks['http.request'](event);
  assert.equal(event.request, before);
});

test('non chat-completions paths are rejected for gateway providers', async () => {
  const hooks = await setup();
  await assert.rejects(hooks['http.request'](make('ollama', '/v1/embeddings')), /Chat Completions/);
});

test('retries are disabled for gateway providers only', async () => {
  const hooks = await setup();
  const local = { model: { providerID: 'ollama' }, decision: undefined };
  const cloud = { model: { providerID: 'openrouter' }, decision: undefined };
  await hooks.retry(local); await hooks.retry(cloud);
  assert.deepEqual(local.decision, { retry: false });
  assert.equal(cloud.decision, undefined);
});
