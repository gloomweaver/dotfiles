import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { once } from 'node:events';
import { createPromptCounter } from './tokenizer.mjs';

export const chains = {
  build: ['deepseek/deepseek-v4-pro-0813', 'moonshotai/kimi-k2.7-code', 'anthropic/claude-sonnet-5.5'],
  utility: ['google/gemini-3.8-flash', 'moonshotai/kimi-k2.7-code'],
};
const budgets = {
  'flint:40b': [131072, 16384],
  'qwen3-coder:30b': [131072, 8192],
  'llama3.2:3b': [32768, 8192],
};

// Reservations are shared across all models, projects, and OpenCode processes.
export class Slots {
  constructor(limit, queueLimit = 16) { this.limit = limit; this.active = 0; this.queue = []; this.queueLimit = queueLimit; }
  take() {
    if (this.active >= this.limit || this.queue.length) return null;
    this.active++;
    return this.release();
  }
  release() {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active--;
      const next = this.queue.shift();
      if (next) { this.active++; next(); }
    };
  }
  async wait(signal, timeout = 120000) {
    signal.throwIfAborted();
    const slot = this.take();
    if (slot) return slot;
    if (this.queue.length >= this.queueLimit) throw Object.assign(new Error('Routing queue full'), { status: 429 });
    await new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); };
      const ready = () => { cleanup(); resolve(); };
      const fail = () => {
        const index = this.queue.indexOf(ready);
        if (index >= 0) this.queue.splice(index, 1);
        cleanup(); reject(Object.assign(new Error('Routing queue cancelled or timed out'), { status: 503 }));
      };
      const abort = fail;
      const timer = setTimeout(fail, timeout);
      this.queue.push(ready);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) fail();
    });
    return this.release();
  }
}

export function createGateway({ token, localURL = 'http://127.0.0.1:11434/v1/chat/completions',
  cloudURL = 'https://openrouter.ai/api/v1/chat/completions', localHeaderMs = 45000,
  cloudHeaderMs = 60000, idleMs = 120000, log = console.log,
  countPrompt = createPromptCounter() } = {}) {
  const local = new Slots(1), cloud = new Slots(3);
  let circuitUntil = 0;
  const counts = { local: 0, cloud: 0, failures: 0 };
  const equal = value => {
    const a = Buffer.from(value || ''), b = Buffer.from(`Bearer ${token}`);
    return a.length === b.length && timingSafeEqual(a, b);
  };
  const server = http.createServer(async (req, res) => {
    const controller = new AbortController();
    res.on('close', () => { if (!res.writableFinished) controller.abort(); });
    const signal = controller.signal;
    const json = (status, data) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
    try {
      if (!equal(req.headers.authorization)) return json(401, { error: { message: 'Gateway authentication required' } });
      if (req.method === 'GET' && req.url === '/health') return json(200, {
        ok: true, localActive: local.active, localQueued: local.queue.length,
        cloudActive: cloud.active, cloudQueued: cloud.queue.length, circuitOpen: Date.now() < circuitUntil, counts,
      });
      if (req.method !== 'POST' || req.url !== '/v1/chat/completions') return json(404, { error: { message: 'Not found' } });
      let bytes = 0; const chunks = [];
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 4 * 1024 * 1024) throw Object.assign(new Error('Request exceeds 4 MiB'), { status: 413 });
        chunks.push(chunk);
      }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks)); } catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
      const mode = req.headers['x-spillover-mode'] || 'local';
      if (!['cloud', 'mixed', 'local'].includes(mode)) throw Object.assign(new Error('Invalid routing mode'), { status: 400 });
      const budget = budgets[body.model];
      if (!budget || !Array.isArray(body.messages)) throw Object.assign(new Error('Unknown local model or missing messages'), { status: 400 });
      const output = Math.min(Number(body.max_tokens || body.max_completion_tokens || budget[1]), budget[1]);
      if (!(output > 0)) throw Object.assign(new Error('Invalid output budget'), { status: 400 });
      const canCloud = mode !== 'local';
      const textOnly = !body.messages.some(m => Array.isArray(m.content) && m.content.some(p => p.type !== 'text'));
      if (!textOnly && !canCloud) throw Object.assign(new Error('This local route accepts text only. Remove media attachments; cloud fallback remains disabled.'), { status: 400 });
      let promptTokens;
      if (textOnly) {
        try { promptTokens = await countPrompt(body); }
        catch {
          if (!canCloud) throw Object.assign(new Error('Cannot load tokenizer metadata from local Ollama. Check Ollama and the installed model; no cloud fallback in local mode.'), { status: 503 });
        }
      }
      const eligible = textOnly && Number.isSafeInteger(promptTokens) && promptTokens + output + 4096 <= budget[0];
      if (!eligible && !canCloud) throw Object.assign(new Error(
        `Local context budget exceeded for ${body.model}: ${promptTokens} input tokens + ${output} output allowance + 4096 template reserve > ${budget[0]}. Start a fresh session or compact history locally, then retry /preset local-plan. No cloud fallback in local mode.`), { status: 400 });
      const key = req.headers['x-spillover-cloud-key'];
      let reason = !eligible ? 'capacity-or-capabilities' : Date.now() < circuitUntil ? 'local-circuit-open' : 'local-busy';
      let release = null;
      if (!canCloud) release = await local.wait(signal);
      else if (eligible && Date.now() >= circuitUntil) release = local.take();

      const send = async (target, payload, auth, headerMs) => {
        const timer = setTimeout(() => controller.abort(), headerMs);
        try {
          return await fetch(target, { method: 'POST', signal, headers: {
            'content-type': 'application/json', ...(auth ? { authorization: `Bearer ${auth}` } : {}),
          }, body: JSON.stringify(payload) });
        } finally { clearTimeout(timer); }
      };
      // Separate abort controller for local header timeout so cloud may still run.
      const localSend = async payload => {
        const attempt = new AbortController();
        const cancel = () => attempt.abort(); signal.addEventListener('abort', cancel, { once: true });
        if (signal.aborted) cancel();
        const timer = setTimeout(cancel, localHeaderMs);
        try { return await fetch(localURL, { method: 'POST', signal: attempt.signal,
          headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }); }
        finally { clearTimeout(timer); signal.removeEventListener('abort', cancel); }
      };
      let response, selected;
      if (release) {
        try {
          const payload = { ...body, max_tokens: output }; delete payload.max_completion_tokens;
          delete payload.models; delete payload.reasoning; delete payload.reasoning_effort;
          delete payload.provider;
          response = await localSend(payload);
          if (!response.ok) { await response.body?.cancel(); throw new Error('Local upstream rejected request'); }
          counts.local++; selected = 'local'; reason = 'local-slot-reserved';
          circuitUntil = 0;
        } catch {
          release(); release = null; counts.failures++; circuitUntil = Date.now() + 30000;
          if (!canCloud || signal.aborted) throw Object.assign(new Error('Local backend unavailable; cloud forbidden or request cancelled'), { status: 503 });
          reason = 'local-failure';
        }
      }
      if (!response?.ok) {
        if (!key) throw Object.assign(new Error('Cloud overflow needs an active OpenRouter API-key connection'), { status: 503 });
        release = await cloud.wait(signal, 30000);
        try {
          const models = body.model === 'flint:40b' || body.model === 'qwen3-coder:30b' ? chains.build : chains.utility;
          const payload = { ...body, model: models[0], models, max_tokens: output,
            provider: { require_parameters: true } };
          delete payload.max_completion_tokens; delete payload.reasoning_effort;
          response = await send(cloudURL, payload, key, cloudHeaderMs);
          if (!response.ok) { await response.body?.cancel(); throw Object.assign(new Error(`Cloud upstream returned ${response.status}`), { status: response.status }); }
          selected = 'cloud'; counts.cloud++;
        } catch (error) { release(); release = null; throw error; }
      }
      const startedMs = Date.now();
      log(JSON.stringify({ time: new Date().toISOString(), mode, target: selected, model: body.model, reason, promptTokens }));
      // Once headers/body have been sent, NEVER retry on a different model.
      try {
        res.writeHead(200, { 'content-type': response.headers.get('content-type') || 'application/json',
          'cache-control': 'no-store', 'x-spillover-target': selected, 'x-spillover-reason': reason });
        const reader = response.body.getReader();
        const cancel = () => { void reader.cancel().catch(() => {}); };
        signal.addEventListener('abort', cancel, { once: true });
        if (signal.aborted) cancel();
        let bodyBytes = [];
        try {
          while (true) {
            let timer;
            const result = await Promise.race([reader.read(), new Promise((_, reject) => {
              timer = setTimeout(() => reject(new Error('Upstream stream idle timeout')), idleMs);
            })]).finally(() => clearTimeout(timer));
            if (result.done) break;
            const chunk = Buffer.from(result.value);
            bodyBytes.push(chunk);
            if (!res.write(chunk)) await once(res, 'drain', { signal });
          }
          res.end();
        } finally { signal.removeEventListener('abort', cancel); await reader.cancel().catch(() => {}); }

        // Parse the upstream body once the stream is done, to record completion
        // usage (tokens) and OpenRouter's reported cost, if present. OpenAI-
        // compatible software sends usage on the final chunk (or one shot).
        try {
          const text = Buffer.concat(bodyBytes).toString('utf8').trim();
          if (!text) throw new Error('empty body');
          // Streamed SSE has "data: " lines; one-shot is a plain JSON object.
          let payload = text;
          const dataLines = text.split('\n').filter(l => l.startsWith('data:'));
          if (dataLines.length) payload = dataLines.map(l => l.slice(5).trim()).filter(l => l !== '[DONE]').join('');
          const usage = JSON.parse(payload)?.usage;
          log(JSON.stringify({
            time: new Date().toISOString(), mode, target: selected, model: body.model,
            wallMs: Date.now() - startedMs,
            completionTokens: usage?.completion_tokens ?? usage?.output_tokens,
            cost: usage?.cost,
          }));
        } catch (error) {
          log(JSON.stringify({ time: new Date().toISOString(), mode, target: selected, model: body.model, wallMs: Date.now() - startedMs, usageError: error.message }));
        }
      } finally { release?.(); }
    } catch (error) {
      if (!res.headersSent && !res.destroyed) json(error.status || 502, { error: { message: error.status ? error.message : 'Gateway upstream failure', type: 'routing_error' } });
      else res.destroy();
    }
  });
  server.requestTimeout = 15000;
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const token = readFileSync(new URL('./token', import.meta.url), 'utf8').trim();
  createGateway({ token }).listen(11435, '127.0.0.1', () => console.log('Spillover gateway listening on 127.0.0.1:11435'));
}
