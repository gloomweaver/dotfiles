import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byteAlphabet, tokenizerFromGGUF, createPromptCounter, estimateTokens } from './tokenizer.mjs';

function metadata(pre = 'qwen2', merged = 'hi') {
  const alphabet = byteAlphabet(), vocab = [];
  for (const [char, byte] of alphabet) vocab[byte] = char;
  vocab.push(merged, '<special>');
  return { 'tokenizer.ggml.model': 'gpt2', 'tokenizer.ggml.pre': pre,
    'tokenizer.ggml.tokens': vocab, 'tokenizer.ggml.token_type': [...Array(257).fill(1), 3] };
}

test('GGUF vocabulary conversion preserves byte-level BPE IDs and Unicode', () => {
  const tokenizer = tokenizerFromGGUF(metadata());
  assert.deepEqual(tokenizer.encode('hi hi'), [256, 32, 256]);
  const text = 'Привет 🦆\nOdin + raylib';
  assert.equal(tokenizer.decode(tokenizer.encode(text)), text);
  assert.equal(tokenizer.encode(text).length, Buffer.byteLength(text));
  assert.doesNotThrow(() => tokenizer.encode('<special>', [], []));
});

test('Qwen and Llama use their different number pretokenizers', () => {
  assert.equal(tokenizerFromGGUF(metadata('qwen2', '12')).encode('12').length, 2);
  assert.equal(tokenizerFromGGUF(metadata('llama-bpe', '12')).encode('12').length, 1);
});

test('counter uses local model metadata, counts tools, and shares metadata loads', async () => {
  let loads = 0;
  const count = createPromptCounter({ fetchModel: async () => { loads++; return metadata(); } });
  const body = { model: 'test', messages: [{ role: 'user', content: 'hi' }] };
  const values = await Promise.all([count(body), count(body)]);
  assert.equal(loads, 1); assert.equal(values[0], values[1]);
  assert.ok(await count({ ...body, tools: [{ type: 'function', function: { name: 'read' } }] }) > values[0]);
});

test('failed metadata loads may recover; unsupported tokenizers never guess', async () => {
  let loads = 0;
  const count = createPromptCounter({ fetchModel: async () => { if (++loads === 1) throw new Error('offline'); return metadata(); } });
  const body = { model: 'test', messages: [] };
  await assert.rejects(count(body), /offline/);
  assert.ok(await count(body) > 0); assert.equal(loads, 2);
  assert.throws(() => tokenizerFromGGUF({ 'tokenizer.ggml.pre': 'unknown' }), /Unsupported/);
});

test('models without a GGUF vocab fall back to a conservative estimate', async () => {
  const info = { 'flint.vocab_size': 262144, 'general.architecture': 'flint' }; // no tokenizer.ggml.*
  const count = createPromptCounter({ fetchModel: async () => info });
  const body = { model: 'flint:40b', messages: [{ role: 'user', content: 'hello world' }] };
  const n = await count(body);
  // Estimate is strictly positive and over-counts relative to a naive 4-char guess.
  assert.ok(n > 0);
  assert.equal(n, estimateTokens(JSON.stringify({ messages: body.messages, tools: undefined })));
});
