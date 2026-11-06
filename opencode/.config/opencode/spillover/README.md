# Local-first routing

Installed for OpenCode 2.2.1. The plugin intercepts Ollama/local-router inference
requests and sends them through an authenticated gateway on `127.0.0.1:11435`.
The gateway runs at login via `~/Library/LaunchAgents/ai.opencode.spillover.plist`.

## Select a preset

Use the command, not just agent selection: OpenCode stores the session's model
separately from its agent. The command switches both.

```text
/preset cloud-build
/preset cloud-plan
/preset mixed-build
/preset mixed-plan
/preset local-build
/preset local-plan
```

| Preset | Primary inference | Supporting requests |
| --- | --- | --- |
| Cloud | Existing OpenRouter plan/build fallback chains | Local-first; overflow to cloud |
| Mixed plan | Existing OpenRouter plan fallback chain | Local-first; overflow to cloud |
| Mixed build | Flint 40B, otherwise cloud build chain | Local-first; overflow to cloud |
| Local | Flint 40B | Local only; queue or fail explicitly |

`build` and `plan` (and `general`) use Flint 40B; `explore` uses Qwen3 Coder 30B;
maintenance agents (`summary`, `title`) use Llama 3.2 3B.
Their actual requests inherit the **root session's** privacy policy. Subagent
model overrides cannot opt an explicit local-only root into cloud inference.
The default build/plan configuration remains local. Existing default-agent
sessions with an explicitly selected OpenRouter model are treated as cloud;
choose `/preset local-build` or `/preset local-plan` to enforce local-only.

## Capacity and failure policy

- One shared local inference slot across gateway clients, projects and models.
- Cloud/mixed: a new request spills immediately when local is busy, the
  conservative context check fails, or the local backend is unavailable.
- Up to **three concurrent overflow requests** (not a cap on primary cloud calls).
- Local-only: FIFO queue, maximum 16 queued requests, 120-second queue timeout.
  Requests too large for the local budget fail with a useful error; they are not
  silently truncated or sent to cloud. Compact context or split the task.
- Overflow queue: maximum 16 queued, 30-second timeout.
- Local response-header timeout: 45 seconds; cloud: 60 seconds. Local failures
  open a 30-second circuit breaker for cloud/mixed requests.
- No retry/failover after response output begins. Automatic OpenCode retries
  are disabled for these gateway-backed requests to avoid replaying partial work.
- A stalled stream is terminated after 120 seconds without a chunk.
- Requests are limited to 4 MiB; only the three configured local model IDs work.
- Local eligibility counts serialized messages and tool schemas with the installed
  model's byte-level BPE vocabulary, fetched from local Ollama's verbose `/api/show`.
  Tokenizers are cached in memory; no prompts go to a cloud tokenizer and no model
  files are downloaded. A separate 4k reserve covers chat-template overhead, in
  addition to the requested output allowance. This does not render the exact Go
  chat template, so the final assembled prompt size remains an estimate.
- Context errors report input tokens, output allowance, template reserve and the
  context limit separately. Capability errors (e.g. media on a text-only local
  route) are distinct. If a long existing session really exceeds the local window,
  start a fresh session or compact locally. A shorter latest message alone does
  not remove old history.
- If local tokenizer metadata cannot be loaded, local mode fails explicitly;
  cloud/mixed may overflow. Unknown tokenizer formats are never silently guessed.
- Limits in OpenCode describe budgets; they do not change Ollama's actual
  context allocation or guarantee that a task/model is suitable for local AI.

Overflow chains are in `gateway.mjs`:

- Flint 40B requests: DeepSeek V4 Pro → Kimi K2.7 Code → Claude Sonnet 5.5.
- Other workers: Gemini 3.8 Flash → Kimi K2.7 Code.

OpenRouter supplies cloud-to-cloud model failover. The plugin resolves the active
OpenRouter API-key connection for each cloud/mixed request; no cloud key is copied
to disk by this setup. A missing connection fails overflow explicitly.

## Typed judge (`/verify`)

`/verify` grades the current session's finished work against its acceptance
criteria using a local typed decision model, not a free-text LLM.

- The local judge is AutoTrust's `autotrust-jev:9b-nvfp4`, served by Ollama's
  `/v1/systemone` endpoint (requires Ollama v0.35.0+). It answers **noul**
  (yes/no with a probability) questions and returns probabilities the plugin
  turns into a verdict. It calls Ollama directly on 11434, bypassing the chat
  gateway.
- Each line of the acceptance criteria becomes one atomic yes/no check. Checks
  are asked with an explicit polarity (`intent: satisfied`), so a low
  P(satisfied) means the check failed. In code, a violation probability of
  **0.7 or above** fails, below **0.3** passes, and anything in between is
  reported as **UNCERTAIN**.
- The judge's evidence is the stored transcript **plus** the session's file
  diff (`ctx.session.diff`). The transcript is assembled from every message
  shape — user `text`, assistant `content`, and tool results under
  `state.content` — because reading only `content[].text` silently drops user
  turns and tool output. The diff answers the "no file/line visible" gap a
  prose-only feed causes.
- The local judge never calls the cloud by itself. In cloud/mixed presets,
  `/verify` escalates a non-PASS local verdict (or a malformed/unknown local
  answer) to the OpenRouter build router; the local preset always stays local
  and reports **UNCERTAIN** as-is.
- Criteria are passed one requirement per line (surrounding quotes are
  stripped). Empty criteria are rejected before the judge runs; a
  `[verify] Reviewing…` message is posted first so the run never looks silent.
- **`/verify` with no argument now derives its criteria automatically.** It
  reads the user's request (first real request plus the latest follow-up),
  sends it to a small local model (`llama3.2:3b` via Ollama's `/api/chat`,
  bypassing the gateway so it runs in every preset) for up to 5 checkable
  statements, then adds two generic checks (the finished state; final claims
  backed by tool output/diff). If derivation fails it falls back to one
  criterion built from the request itself. If the request is too short or vague
  to derive from (an acknowledgement like "go" or "do it"), derivation is
  skipped and the two generic checks grade the work alone — the small model is
  never handed a blank it would fill with hallucinations.

### Automatic judge (`experimental.idle`)

The judge also runs on its own, with no hand-written criteria.

- It fires on the `experimental.idle` hook — when a session finishes model work
  with no pending input. It skips when background work is still running (the
  hook re-fires when that finishes), in child/subagent sessions, in plan agents,
  when nothing changed (same diff + user-turn + tool-call signature), when there
  is neither a diff nor any tool call, and after **3 rounds without a new
  request**.
- Criteria come from the same derivation above. A `PASS` or `UNCERTAIN` verdict
  is posted but does **not** wake the agent; a `FAIL` (or a cloud FAIL) is posted
  for the agent to fix, which starts a new round.
- Preset behaviour is unchanged: local never calls cloud; cloud/mixed escalate
  non-PASS verdicts to `router/build`.
- Opt out with `/autoverify off` (or `status`, `on`), or set
  `SPILLOVER_AUTOVERIFY=0`. `/autoverify` is in-memory and resets when the
  plugin reloads.
- Every run is appended to `verdict.log` (JSONL, gitignored) as
  `{ts, task, preset, source, model, verdict, failures, uncertain, escalated,
  turns, reason, probabilities}`. `source` is `verify` (manual/derived command)
  or `idle` (automatic). `reason` records judge transport/schema failures;
  `probabilities` records per-check P(true) so a mid-range UNCERTAIN can be
  told apart from a judge outage. This is the evidence base for eventual model
  routing; it is not used to pick a model today.

Validation against the `~/repos/build-compare` corpus (a Go `jsonfmt` with a
known-good and a known-bad implementation) confirms the local judge flags the
bad build's spec violations and passes the good ones.

```sh
SKIP_JUDGE_LIVE=1 node --test judge.test.mjs   # unit tests only
node --test judge.test.mjs                     # includes a live /v1/systemone call
```

## Cost, privacy and scope

**Overflow is billed by OpenRouter.** OpenCode sees the local model identity and
may not attribute the overflow cost correctly; use OpenRouter's usage dashboard
for authoritative billing. Three-way concurrency limits bursts, not total spend.

Cloud/mixed grants permission to send the full outgoing request context to cloud.
Explicit local presets block nonlocal **session inference** requests in the
plugin. This is not a network sandbox: web tools, shell commands, MCPs, other
plugins, and external applications can still use the network independently.

Only requests passing through this gateway share its capacity reservation.
Direct Ollama use from other apps is not measured. The gateway does not configure
Ollama's memory residency, parallelism or context length. It does not assess the
quality of model answers or automatically break a feature into coding tasks.
The agent receives bounded-delegation guidance; the three-child limit is guidance,
not an enforced scheduler quota.

The gateway requires its own random `token` (mode 0600), binds only to loopback,
and logs routing metadata, not prompts or keys. The token is not an OpenRouter key.

## Inspect and test

```sh
node ~/.config/opencode/spillover/status.mjs
cd ~/.config/opencode/spillover
npm test
```

Logs: `gateway.log` and `gateway.error.log` in this directory. Logs are not
automatically rotated. The launch agent uses a versioned Node executable; update
its `ProgramArguments` if that Node version is removed.

Restart **only the gateway** after changing its code or chains:

```sh
launchctl kickstart -k gui/$(id -u)/ai.opencode.spillover
```

OpenCode watches its config and reloads plugins; `/reload` can force a reload.
No OpenCode service restart is necessary.

## Disable / rollback

Remove the spillover entry from `plugins`, change `build-mixed` back to
`ollama/flint:40b`, and optionally remove the `local-router` provider.
Without the plugin, direct Ollama models bypass gateway scheduling.

Stop the gateway and disable it for the current login:

```sh
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/ai.opencode.spillover.plist
```

Move the plist out of `~/Library/LaunchAgents` to prevent it starting next login.
The pre-install configuration backup is
`~/.config/opencode/opencode.jsonc.before-spillover-2026-11-06T18-56-32.082Z`.
Do not restore it wholesale if you have made newer configuration changes.
