import { readFileSync } from 'node:fs';
const token = readFileSync(new URL('./token', import.meta.url), 'utf8').trim();
const response = await fetch('http://127.0.0.1:11435/health', { headers: { authorization: `Bearer ${token}` } });
if (!response.ok) throw new Error(`Gateway health returned ${response.status}`);
console.log(JSON.stringify(await response.json(), null, 2));
