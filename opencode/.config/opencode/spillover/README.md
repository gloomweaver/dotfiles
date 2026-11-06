# Local-first routing gateway

Installed for OpenCode 2.2.1. A small plugin (`index.mjs`) sends `ollama/*` and
`local-router/*` inference requests through an authenticated gateway on
`127.0.0.1:11435`. The gateway runs at login via
`~/Library/LaunchAgents/ai.opencode.spillover.plist`.

There are two agents, `build` and `plan`. Routing is decided by the model you pick:

| Model provider | Gateway mode | Behavior |
| --- | --- | --- |
| `ollama/*` | `local` | Queued on the single local slot. Never goes to cloud. Too-large prompts fail with an explicit error. |
| `local-router/build` | `mixed` | Flint first. Spills to cloud when local is busy, the prompt is too large, or local fails. |
| `openrouter/*` | (bypasses gateway) | Straight to OpenRouter. |

`build` and `general` default to `local-router/build`, `plan` to
`openrouter/router/plan`, `explore` to Qwen3 Coder 30B, `summary` and `title` to
Llama 3.2 3B. Change the model with the model picker.

## Capacity and failure policy

- One shared local inference slot across gateway clients, projects and models.
- Mixed: a new request spills immediately when local is busy, the conservative
  context check fails, or the local backend is unavailable.
- Up to **three concurrent overflow requests** (not a cap on primary cloud calls).
- Local-only: FIFO queue, maximum 16 queued requests, 120-second queue timeout.
  Requests too large for the local budget fail with a useful error; they are not
  silently truncated or sent to cloud. Compact context or split the task.
- Overflow queue: maximum 16 queued, 30-second timeout.
- Local response-header timeout: 45 seconds; cloud: 60 seconds. Local failures
  open a 30-second circuit breaker for mixed requests.
- No retry/failover after response output begins. Automatic OpenCode retries
  are disabled for gateway-backed requests to avoid replaying partial work.
- A stalled stream is terminated after 120 seconds without a chunk.
- Requests are limited to 4 MiB; only the configured local model IDs work.
- Local eligibility counts serialized messages and tool schemas with the installed
  model's byte-level BPE vocabulary, fetched from local Ollama's verbose `/api/show`.
  A separate 4k reserve covers chat-template overhead, in addition to the
  requested output allowance. The final assembled prompt size remains an estimate.
- If local tokenizer metadata cannot be loaded, `local` mode fails explicitly;
  `mixed` may overflow.

Overflow chains are in `gateway.mjs`:

- Flint 40B requests: DeepSeek V4 Pro → Kimi K2.7 Code → Claude Sonnet 5.5.
- Other workers: Gemini 3.8 Flash → Kimi K2.7 Code.

The plugin resolves the active OpenRouter API-key connection for each `mixed`
request; no cloud key is copied to disk. A missing connection fails overflow
explicitly.

## Usage log

`gateway.log` gets two JSON lines per request:

- On routing: `{time, mode, target, model, reason, promptTokens}`.
- On completion: `{time, mode, target, model, wallMs, completionTokens, cost}`.
  `cost` is OpenRouter's reported cost and only appears for cloud requests.
  `usageError` is logged instead if the usage block could not be parsed.

Logs are not automatically rotated. Prompts and keys are never logged.

## Cost, privacy and scope

Overflow is billed by OpenRouter. Use the `cost` field above or OpenRouter's
usage dashboard.

Choosing an `ollama/*` model keeps inference local, but this is not a network
sandbox: web tools, shell commands, MCPs and other plugins can still use the
network independently. Only requests through this gateway share its capacity
reservation; direct Ollama use from other apps is not measured.

The gateway requires its own random `token` (mode 0600), binds only to loopback,
and is not an OpenRouter key.

## Inspect and test

```sh
node ~/.config/opencode/spillover/status.mjs
cd ~/.config/opencode/spillover
npm test
```

Restart **only the gateway** after changing its code or chains:

```sh
launchctl kickstart -k gui/$(id -u)/ai.opencode.spillover
```

OpenCode watches its config and reloads plugins; `/reload` can force a reload.

## Disable / rollback

Remove the spillover entry from `plugins`, change `build` and `general` back to
`ollama/flint:40b`, and optionally remove the `local-router` provider. Without the
plugin, direct Ollama models bypass gateway scheduling.

Stop the gateway and disable it for the current login:

```sh
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/ai.opencode.spillover.plist
```

Move the plist out of `~/Library/LaunchAgents` to prevent it starting next login.
