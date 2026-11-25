#!/usr/bin/env node
// Pick the best Gemini model that Antigravity (agy) actually offers right now, for a task type.
// Why: when Orca starts an Antigravity worker with a model the account doesn't have (2026-11-25: Argon),
// agy silently falls back to another model in interactive mode. Asking agy first avoids that.
//
// Usage: node pick-gemini.mjs <creative|research|code|math|quick>
// Prints JSON: { pick, preferred, fallback, available } - pass `pick` to
//   orca orchestration worker-start ... --agent antigravity --model <pick>
// If `fallback` is true, the preferred model is missing: tell the user which one ran instead.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PREFERENCES = {
  // Visual/UI design, creative web prototypes, image prompts. Neon = strongest all-round Gemini 4 (Nov 18).
  creative: ['gemini-4-neon-xhigh', 'gemini-4-neon-high', 'gemini-4-carbon-high', 'gemini-4-hydrogen-xhigh', 'gemini-4-argon-high', 'gemini-3.8-flash-high'],
  // Deep, Google-grounded research (names, trademarks, terms, store rules). Carbon = slowest, deepest.
  research: ['gemini-4-carbon-high', 'gemini-4-neon-high', 'gemini-4-neon-medium', 'gemini-4-hydrogen-high', 'gemini-4-argon-medium', 'gemini-3.8-flash-high'],
  // Math/formula verification (with code execution).
  math: ['gemini-4-neon-xhigh', 'gemini-4-neon-high', 'gemini-4-carbon-high'],
  // Code work or a cross-family code review (Neon tops the coding-agent index among Gemini 4).
  code: ['gemini-4-carbon-high', 'gemini-4-neon-high', 'gemini-4-hydrogen-high', 'gemini-4-argon-high'],
  // Short lookups and summaries: fast and cheap.
  quick: ['gemini-3.8-flash-medium', 'gemini-3.8-flash-high', 'gemini-4-hydrogen-low', 'gemini-4-hydrogen-medium'],
};

function agyPath() {
  const root = join(process.env.APPDATA ?? '', 'orca', 'agent-runtimes', 'agy');
  if (!existsSync(root)) throw new Error(`Antigravity runtime not found under ${root}`);
  const versions = readdirSync(root).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  for (const v of versions.reverse()) {
    for (const name of ['agy.exe', 'agy']) {
      const p = join(root, v, name);
      if (existsSync(p)) return p;
    }
  }
  throw new Error('agy executable not found');
}

const role = process.argv[2] ?? 'creative';
const prefs = PREFERENCES[role];
if (!prefs) {
  console.error(`unknown role "${role}" - use one of: ${Object.keys(PREFERENCES).join(', ')}`);
  process.exit(2);
}

// stderr is captured, not printed: agy writes "Fetching available models..." there, which would break the JSON.
const out = execFileSync(agyPath(), ['models'], { encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] });
const available = out
  .split(/\r?\n/)
  .map((l) => l.split('\t')[0].trim())
  .filter((id) => /^[a-z0-9.\-]+$/.test(id) && id.includes('-'));

const pick = prefs.find((id) => available.includes(id)) ?? null;
// On the "Individual" plan the premium Gemini 4 models vanish from `agy models` once the weekly quota is used up,
// and even a listed model can then fail with "Individual quota reached". `--probe` sends a 1-line prompt to the pick
// to prove it can actually run before a worker is dispatched (costs a few tokens).
let quota = 'unchecked';
if (pick && process.argv.includes('--probe')) {
  try {
    const raw = execFileSync(agyPath(), ['-p', 'Reply with exactly: OK', '--model', pick, '--output-format', 'json', '--print-timeout', '90s'], {
      encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'],
    });
    const m = raw.match(/\{[\s\S]*\}\s*$/);
    const res = m ? JSON.parse(m[0]) : {};
    quota = res.status === 'SUCCESS' ? 'ok' : `failed: ${String(res.response ?? res.error ?? raw).slice(0, 160)}`;
  } catch (e) {
    const text = `${e.stdout ?? ''}${e.stderr ?? ''}${e.message ?? ''}`;
    quota = /quota/i.test(text) ? `exhausted: ${(text.match(/Resets in [^.\n"]+/) ?? ['?'])[0]}` : `failed: ${text.slice(0, 160)}`;
  }
}
// Which Google account is agy signed in as? Orca re-signs agy with its own stored account, and the two accounts have
// separate quotas (2026-11-25: osh… had quota, ork… was exhausted), so a result means nothing without the account.
const EXPECTED_ACCOUNT = process.env.AGY_EXPECTED_ACCOUNT ?? 'osh';
function signedInAccount() {
  const dir = join(homedir(), '.gemini', 'antigravity-cli', 'log');
  if (!existsSync(dir)) return null;
  const logs = readdirSync(dir).filter((f) => f.startsWith('cli-')).map((f) => join(dir, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs).slice(0, 3);
  for (const f of logs) {
    const hits = [...readFileSync(f, 'utf8').matchAll(/authenticated successfully as (\S+?)@/g)];
    if (hits.length) return hits[hits.length - 1][1];
  }
  return null;
}
const acct = signedInAccount();
const account = acct ? `${acct.slice(0, 3)}…` : 'unknown';
const wrongAccount = acct !== null && !acct.startsWith(EXPECTED_ACCOUNT);
const premiumMissing = !available.some((id) => /gemini-4-(neon|carbon|argon)/.test(id));
const result = {
  role, account, pick, preferred: prefs[0], fallback: pick !== prefs[0], quota,
  accountWarning: wrongAccount ? `agy is signed in as ${account}, expected ${EXPECTED_ACCOUNT}… - switch the Antigravity account in Orca Settings before dispatching` : undefined,
  note: premiumMissing ? 'Neon/Carbon/Argon are not listed: on the Individual plan this usually means the weekly quota is used up.' : undefined,
  available,
};
console.log(JSON.stringify(result, null, 2));
if (!pick || wrongAccount || quota.startsWith('exhausted') || quota.startsWith('failed')) process.exit(1);
