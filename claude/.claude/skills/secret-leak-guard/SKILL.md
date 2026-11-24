---
name: secret-leak-guard
description: Blocks reading, printing, or hardcoding secrets, credentials, and private keys.
---

# Secret Leak Guard Protocol

1. **Forbid Dumping Environment Files:**
   - Never run `cat .env*`, `printenv`, or `export` in terminal commands if the output will be reflected into the conversation transcript.
   - To inspect configuration, check `.env.example` or search only for specific variable *names*, never their values.
2. **No Hardcoded Credentials:**
   - Never insert raw API keys, bearer tokens, passwords, or private keys into test fixtures, mocks, or application code.
   - Always route secrets through environment variables or secure secret managers.
3. **Log Sanitization:**
   - Ensure new log statements do not dump entire raw request/response payloads that may contain headers (e.g. `Authorization`), session cookies, or PII.
