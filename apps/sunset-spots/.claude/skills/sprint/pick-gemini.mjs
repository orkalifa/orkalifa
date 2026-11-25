#!/usr/bin/env node
// Pick the best Gemini model that Antigravity (agy) actually offers right now, for a task type.
// Why: when Orca starts an Antigravity worker with a model the account doesn't have (2026-11-25: Argon),
// agy silently falls back to another model in interactive mode. Asking agy first avoids that.
//
// Usage: node pick-gemini.mjs <creative|research|code|quick>
// Prints JSON: { pick, preferred, fallback, available } - pass `pick` to
//   orca orchestration worker-start ... --agent antigravity --model <pick>
// If `fallback` is true, the preferred model is missing: tell the user which one ran instead.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PREFERENCES = {
  // Visual/UI design, creative web prototypes, image prompts. Neon = strongest all-round Gemini 4 (Nov 18).
  creative: ['gemini-4-neon-xhigh', 'gemini-4-neon-high', 'gemini-4-carbon-high', 'gemini-4-hydrogen-xhigh', 'gemini-4-argon-high', 'gemini-3.8-flash-high'],
  // Deep, Google-grounded research (names, trademarks, terms, store rules). Carbon = slowest, deepest.
  research: ['gemini-4-carbon-high', 'gemini-4-neon-high', 'gemini-4-neon-medium', 'gemini-4-hydrogen-high', 'gemini-4-argon-medium', 'gemini-3.8-flash-high'],
  // Code work or a third-opinion code review (Neon tops the coding-agent index among Gemini 4).
  code: ['gemini-4-neon-high', 'gemini-4-carbon-high', 'gemini-4-hydrogen-high', 'gemini-4-argon-high'],
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
const result = { role, pick, preferred: prefs[0], fallback: pick !== prefs[0], available };
console.log(JSON.stringify(result, null, 2));
if (!pick) process.exit(1);
