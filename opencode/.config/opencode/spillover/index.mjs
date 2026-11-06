import { Plugin } from '@opencode/plugin';
import { readFileSync } from 'node:fs';

const LOCAL = ['ollama', 'local-router'];

// Routing follows the selected model:
//   ollama/*        -> gateway, mode "local": queued locally, never cloud
//   local-router/*  -> gateway, mode "mixed": local first, spills to cloud when busy/too large
//   anything else   -> untouched (OpenRouter etc. go direct)
export function modeFor(providerID) {
  if (providerID === 'local-router') return 'mixed';
  if (providerID === 'ollama') return 'local';
  return undefined;
}

export default Plugin.define({
  id: 'local.spillover',
  async setup(ctx) {
    const token = readFileSync(new URL('./token', import.meta.url), 'utf8').trim();
    await ctx.session.hook('http.request', async event => {
      const mode = modeFor(event.model.providerID);
      if (!mode) return;
      const url = new URL(event.request.url);
      // Never forward arbitrary requests or keys to an untrusted URL.
      if (url.pathname !== '/v1/chat/completions') throw new Error('Spillover requires Chat Completions');
      const headers = new Headers(event.request.headers);
      headers.set('authorization', `Bearer ${token}`);
      headers.set('x-spillover-mode', mode);
      headers.delete('x-spillover-cloud-key');
      if (mode === 'mixed') {
        const connection = await ctx.integration.connection.active('openrouter');
        const credential = connection ? await ctx.integration.connection.resolve(connection) : undefined;
        if (credential?.type === 'key') headers.set('x-spillover-cloud-key', credential.key);
      }
      event.request = new Request('http://127.0.0.1:11435/v1/chat/completions', {
        method: 'POST', headers, body: event.request.body, duplex: 'half', signal: event.request.signal,
      });
    });
    await ctx.session.hook('retry', event => {
      if (LOCAL.includes(event.model.providerID)) event.decision = { retry: false };
    });
  },
});
