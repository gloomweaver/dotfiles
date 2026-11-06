import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createGateway, Slots, chains } from './gateway.mjs';

const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function listen(server) { server.listen(0, '127.0.0.1'); await once(server, 'listening'); return `http://127.0.0.1:${server.address().port}`; }
async function fixture(t, options = {}) {
  const calls = { local: [], cloud: [] }, started = deferred(), finish = deferred();
  const local = http.createServer(async (req, res) => {
    let data = ''; for await (const c of req) data += c;
    calls.local.push(JSON.parse(data)); started.resolve();
    if (options.fail) { res.writeHead(503); return res.end('unavailable'); }
    if (options.hold) await finish.promise;
    if (options.partial) {
      res.writeHead(200, { 'content-type': 'text/event-stream' }); res.write('data: partial\n\n');
      await finish.promise; res.destroy(); return;
    }
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ target: 'local' }));
  });
  const cloud = http.createServer(async (req, res) => {
    let data = ''; for await (const c of req) data += c;
    calls.cloud.push({ body: JSON.parse(data), headers: req.headers });
    res.writeHead(options.cloudFail ? 429 : 200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ target: 'cloud' }));
  });
  const localURL = await listen(local), cloudURL = await listen(cloud);
  const gateway = createGateway({ token: 'test', localURL, cloudURL, log() {},
    localHeaderMs: options.headerMs || 1000, idleMs: 1000,
    countPrompt: options.countPrompt || (async body => Math.ceil(JSON.stringify({ messages: body.messages, tools: body.tools }).length / 4)) });
  const url = await listen(gateway);
  t.after(async () => {
    finish.resolve();
    await Promise.all([gateway, local, cloud].map(s => new Promise(r => { s.close(r); s.closeAllConnections(); })));
  });
  const headers = { authorization: 'Bearer test', 'content-type': 'application/json' };
  const request = (mode = 'mixed', body = {}, extra = {}) => fetch(`${url}/v1/chat/completions`, {
    method: 'POST', headers: { ...headers, 'x-spillover-mode': mode, 'x-spillover-cloud-key': 'mock-cloud-key' },
    body: JSON.stringify({ model: 'llama3.2:3b', messages: [{ role: 'user', content: 'hi' }], ...body }), ...extra,
  });
  const health = () => fetch(`${url}/health`, { headers }).then(r => r.json());
  return { request, health, calls, started, finish, url };
}

test('one shared local slot and immediate overflow; credentials stay on cloud hop', async t => {
  const f = await fixture(t, { hold: true });
  const first = f.request(); await f.started.promise;
  const second = await f.request('cloud', { model: 'llama3.2:3b' });
  assert.equal(second.headers.get('x-spillover-target'), 'cloud'); await second.text();
  assert.equal(f.calls.local.length, 1);
  assert.equal(f.calls.cloud[0].headers.authorization, 'Bearer mock-cloud-key');
  assert.equal(f.calls.cloud[0].headers['x-spillover-mode'], undefined);
  assert.deepEqual(f.calls.cloud[0].body.models, chains.utility);
  f.finish.resolve(); const result = await first;
  assert.equal(result.headers.get('x-spillover-target'), 'local'); await result.text();
  assert.equal((await f.health()).localActive, 0);
});

test('local-only queues even when a cloud key is supplied', async t => {
  const f = await fixture(t, { hold: true });
  const first = f.request('local'); await f.started.promise;
  const second = f.request('local');
  // Bounded scheduling turns, not wall-clock timing, to observe queue admission.
  for (let i = 0; i < 20; i++) { if ((await f.health()).localQueued === 1) break; }
  assert.equal((await f.health()).localQueued, 1);
  assert.equal(f.calls.cloud.length, 0);
  f.finish.resolve(); await (await first).text(); await (await second).text();
  assert.equal(f.calls.local.length, 2); assert.equal(f.calls.cloud.length, 0);
});

test('large requests spill in mixed but fail closed in local', async t => {
  const f = await fixture(t);
  const body = { model: 'flint:40b', messages: [{ role: 'user', content: 'x'.repeat(700000) }] };
  const mixed = await f.request('mixed', body); assert.equal(mixed.status, 200); await mixed.text();
  const local = await f.request('local', body); assert.equal(local.status, 400);
  assert.match(await local.text(), /input tokens.*output allowance.*template reserve/);
  assert.equal(f.calls.local.length, 0); assert.equal(f.calls.cloud.length, 1);
  assert.deepEqual(f.calls.cloud[0].body.models, chains.build);
});

test('local failure opens circuit, but local-only still cannot use cloud', async t => {
  const f = await fixture(t, { fail: true });
  await (await f.request()).text(); await (await f.request()).text();
  assert.equal(f.calls.local.length, 1); assert.equal(f.calls.cloud.length, 2);
  const only = await f.request('local'); assert.equal(only.status, 503); await only.text();
  assert.equal(f.calls.cloud.length, 2); assert.equal((await f.health()).localActive, 0);
});

test('local header timeout can spill to cloud', async t => {
  const f = await fixture(t, { hold: true, headerMs: 30 });
  const result = await f.request(); assert.equal(result.headers.get('x-spillover-target'), 'cloud'); await result.text();
  assert.equal((await f.health()).localActive, 0);
});

test('partial streams are never retried on cloud', async t => {
  const f = await fixture(t, { partial: true });
  const result = await f.request(); const reader = result.body.getReader();
  assert.equal(new TextDecoder().decode((await reader.read()).value), 'data: partial\n\n');
  f.finish.resolve(); await assert.rejects(async () => { while (!(await reader.read()).done) {} });
  assert.equal(f.calls.cloud.length, 0);
  assert.equal((await f.health()).localActive, 0);
});

test('cancelling a streaming client frees the local slot', async t => {
  const f = await fixture(t, { partial: true });
  const controller = new AbortController();
  const response = await f.request('mixed', {}, { signal: controller.signal });
  await response.body.getReader().read(); controller.abort();
  for (let i = 0; i < 20; i++) { if ((await f.health()).localActive === 0) break; }
  assert.equal((await f.health()).localActive, 0); assert.equal(f.calls.cloud.length, 0);
});

test('unknown modes/models and unauthenticated traffic rejected', async t => {
  const f = await fixture(t);
  assert.equal((await fetch(`${f.url}/health`)).status, 401);
  for (const [mode, body] of [['invalid', {}], ['mixed', { model: 'arbitrary' }]]) {
    const result = await f.request(mode, body); assert.equal(result.status, 400); await result.text();
  }
  assert.equal(f.calls.local.length + f.calls.cloud.length, 0);
});

test('missing cloud credential returns a clear error without leaking slots', async t => {
  const f = await fixture(t);
  const result = await f.request('mixed', { messages: [{ role: 'user', content: 'x'.repeat(160000) }] }, {
    headers: { authorization: 'Bearer test', 'x-spillover-mode': 'mixed' },
  });
  assert.equal(result.status, 503); assert.match(await result.text(), /API-key/);
  assert.equal((await f.health()).cloudActive, 0);
});

test('cloud errors release reservations', async t => {
  const f = await fixture(t, { cloudFail: true });
  const result = await f.request('mixed', { messages: [{ role: 'user', content: 'x'.repeat(160000) }] });
  assert.equal(result.status, 429); await result.text(); assert.equal((await f.health()).cloudActive, 0);
});

test('logs completion tokens, cost and wall time from the upstream usage', async () => {
  const lines = [];
  const local = http.createServer(async (req, res) => {
    for await (const c of req) {}
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: 'hi' } }], usage: { prompt_tokens: 7, completion_tokens: 42, cost: 0.00012 } }));
  });
  const localURL = await listen(local);
  const gateway = createGateway({ token: 'test', localURL, cloudURL: 'http://127.0.0.1:1', log: l => lines.push(JSON.parse(l)), countPrompt: async () => 7 });
  const url = await listen(gateway);
  const result = await fetch(`${url}/v1/chat/completions`, {
    method: 'POST', headers: { authorization: 'Bearer test', 'content-type': 'application/json', 'x-spillover-mode': 'local' },
    body: JSON.stringify({ model: 'llama3.2:3b', messages: [{ role: 'user', content: 'hi' }] }),
  });
  await result.text();
  await Promise.all([gateway, local].map(s => new Promise(r => { s.close(r); s.closeAllConnections(); })));
  const usageLine = lines.find(l => 'completionTokens' in l);
  assert.ok(usageLine, 'a usage log line must be emitted');
  assert.equal(usageLine.completionTokens, 42);
  assert.equal(usageLine.cost, 0.00012);
  assert.equal(usageLine.target, 'local');
  assert.ok(Number.isFinite(usageLine.wallMs), 'wallMs must be recorded');
});

test('logs usage from a streamed SSE response split across data lines', async () => {
  const lines = [];
  const local = http.createServer(async (req, res) => {
    for await (const c of req) {}
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.write('data: {"id":"1","choices":[{"delta":{"content":"he"}}]}\n\n');
    res.write('data: {"id":"2","choices":[{"delta":{"content":"llo"}}]}\n\n');
    res.write('data: {"id":"3","choices":[{}],"usage":{"completion_tokens":42,"cost":0.00012}}\n\n');
    res.write('data: [DONE]\n\n');
    res.end();
  });
  const localURL = await listen(local);
  const gateway = createGateway({ token: 'test', localURL, cloudURL: 'http://127.0.0.1:1', log: l => lines.push(JSON.parse(l)), countPrompt: async () => 7 });
  const url = await listen(gateway);
  const result = await fetch(`${url}/v1/chat/completions`, {
    method: 'POST', headers: { authorization: 'Bearer test', 'content-type': 'application/json', 'x-spillover-mode': 'local' },
    body: JSON.stringify({ model: 'llama3.2:3b', messages: [{ role: 'user', content: 'hi' }] }),
  });
  await result.text();
  await Promise.all([gateway, local].map(s => new Promise(r => { s.close(r); s.closeAllConnections(); })));
  const usageLine = lines.find(l => 'completionTokens' in l);
  assert.ok(usageLine, 'a usage log line must be emitted');
  assert.equal(usageLine.completionTokens, 42);
  assert.equal(usageLine.cost, 0.00012);
  assert.equal(usageLine.usageError, undefined, 'multi-line SSE must not be a parse error');
});

test('FIFO slots are bounded, cancellation-safe and release is idempotent', async () => {
  const slots = new Slots(1, 1), release = slots.take(); const controller = new AbortController();
  const waiting = slots.wait(controller.signal);
  await assert.rejects(slots.wait(new AbortController().signal), /full/);
  controller.abort(); await assert.rejects(waiting); assert.equal(slots.queue.length, 0);
  release(); release(); assert.equal(slots.active, 0);
  await assert.rejects(slots.wait(controller.signal)); assert.equal(slots.active, 0);
});

test('regression: local flint plan with >32k bytes but fitting token count stays local', async t => {
  const f = await fixture(t);
  const result = await f.request('local', { model: 'flint:40b', max_tokens: 8192,
    messages: [{ role: 'system', content: 'Plan the Odin and raylib raycaster. '.repeat(1200) },
      { role: 'user', content: 'In /repos create a new project and write a simple raycaster using Odin and raylib.' }] });
  assert.equal(result.status, 200); assert.equal(result.headers.get('x-spillover-target'), 'local');
  await result.text(); assert.equal(f.calls.cloud.length, 0);
});

test('tokenizer failure fails local closed, but mixed can use cloud', async t => {
  const f = await fixture(t, { countPrompt: async () => { throw new Error('Ollama offline'); } });
  const local = await f.request('local'); assert.equal(local.status, 503); assert.match(await local.text(), /tokenizer metadata/);
  assert.equal(f.calls.cloud.length, 0);
  const mixed = await f.request('mixed'); assert.equal(mixed.headers.get('x-spillover-target'), 'cloud'); await mixed.text();
});

test('unsupported local media reports capability error separately from context overflow', async t => {
  const f = await fixture(t);
  const local = await f.request('local', { messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:mock' } }] }] });
  assert.equal(local.status, 400); assert.match(await local.text(), /text only/); assert.equal(f.calls.cloud.length, 0);
});
