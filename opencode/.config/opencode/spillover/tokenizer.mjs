import { Tiktoken } from 'js-tiktoken/lite';

// GGUF byte-level BPE vocabularies use GPT-2's reversible byte-to-Unicode map.
// Read the installed model's own vocabulary from Ollama, never a cloud tokenizer.
export function byteAlphabet() {
  const bytes = [...Array.from({ length: 94 }, (_, i) => i + 33),
    ...Array.from({ length: 12 }, (_, i) => i + 161),
    ...Array.from({ length: 82 }, (_, i) => i + 174)];
  const codes = [...bytes];
  for (let b = 0, extra = 0; b < 256; b++) {
    if (!bytes.includes(b)) { bytes.push(b); codes.push(256 + extra++); }
  }
  return new Map(codes.map((code, i) => [String.fromCodePoint(code), bytes[i]]));
}

export function tokenizerFromGGUF(info) {
  const pre = info['tokenizer.ggml.pre'];
  if (info['tokenizer.ggml.model'] !== 'gpt2' || !['qwen2', 'llama-bpe'].includes(pre)) {
    throw new Error('Unsupported local tokenizer; expected qwen2 or llama-bpe byte-level BPE');
  }
  const vocab = info['tokenizer.ggml.tokens'], types = info['tokenizer.ggml.token_type'];
  if (!Array.isArray(vocab) || !Array.isArray(types) || vocab.length !== types.length) {
    throw new Error('Ollama did not provide the verbose tokenizer vocabulary');
  }
  const alphabet = byteAlphabet(), ranks = [], special = {};
  vocab.forEach((token, id) => {
    if (types[id] === 1) {
      const bytes = Array.from(token, c => alphabet.get(c));
      if (bytes.some(b => b === undefined)) throw new Error('Invalid byte-level tokenizer vocabulary');
      // js-tiktoken's compact format: ignored prefix, first rank, base64 tokens.
      ranks.push(`! ${id} ${Buffer.from(bytes).toString('base64')}`);
    } else if ([3, 4].includes(types[id])) special[token] = id;
  });
  // Equivalent to the models' contraction regex, without unsupported JS (?i:).
  const contractions = "'(?:[sStTmMdD]|[rR][eE]|[vV][eE]|[lL][lL])";
  const pat = `${contractions}|[^\\r\\n\\p{L}\\p{N}]?\\p{L}+|\\p{N}${pre === 'llama-bpe' ? '{1,3}' : ''}| ?[^\\s\\p{L}\\p{N}]+[\\r\\n]*|\\s*[\\r\\n]+|\\s+(?!\\S)|\\s+`;
  return new Tiktoken({ pat_str: pat, bpe_ranks: ranks.join('\n'), special_tokens: special });
}

// Models without a Model without an exposed GGUF vocabulary (e.g. Ollama-native
// "flint" parser) cannot be counted with a byte-level BPE. Fall back to a
// conservative character-based estimate instead. The denominator is deliberately
// LOW so the estimate OVER-counts; the gateway's existing 4096-token template
// reserve then guarantees we err toward spilling or failing-closed rather than
// under-counting and risking a local out-of-memory.
export function estimateTokens(text) {
  return Math.ceil(text.length / 2.5);
}

export function createPromptCounter({ ollamaURL = 'http://127.0.0.1:11434', fetchModel = async model => {
  const response = await fetch(`${ollamaURL}/api/show`, { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model, verbose: true }),
    signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Local tokenizer metadata unavailable');
  return (await response.json()).model_info;
} } = {}) {
  const cache = new Map();
  return async body => {
    let counter = cache.get(body.model);
    if (!counter) {
      const resolve = async () => {
        const info = await fetchModel(body.model);
        const ggml = (info || {})['tokenizer.ggml.model'];
        if (!ggml) return text => estimateTokens(text);
        return tokenizerFromGGUF(info);
      };
      counter = Promise.resolve().then(resolve);
      cache.set(body.model, counter);
      counter.catch(() => { if (cache.get(body.model) === counter) cache.delete(body.model); });
    }
    const count = await counter;
    // Count the serialized messages AND tool schemas; for BPE models this is an
    // exact count, for others it is a conservative over-estimate.
    const text = JSON.stringify({ messages: body.messages, tools: body.tools });
    return typeof count === 'function' ? count(text) : count.encode(text, [], []).length;
  };
}
