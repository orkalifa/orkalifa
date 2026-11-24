#!/usr/bin/env node
// Spotlight quality gate: a Claude Code Stop hook.
// When a session (the manager or a team worker) is about to finish with uncommitted changes to the
// app's code, run tests, typecheck and lint. If any fails, block the stop (exit 2) and hand the
// failure back so the agent fixes it. Passing states are remembered, so an unchanged tree is not
// re-checked. After 3 blocked attempts on the same state it lets the stop through with a warning,
// so an agent that can't fix it doesn't loop forever; the manager sees the warning.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MAX_BLOCKS = 3;
const WATCHED = /^apps\/sunset-spots\/(src\/|tests\/|scripts\/|package\.json$|app\.json$|tsconfig\.json$|eslint\.config\.js$)/;

const sh = (cmd, opts = {}) => spawnSync(cmd, { shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
const out = (o) => process.stdout.write(JSON.stringify(o));

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  /* no stdin: run as a plain check */
}

const top = sh('git rev-parse --show-toplevel', { cwd: input.cwd || process.cwd() }).stdout.trim();
if (!top) process.exit(0);
const gitDir = sh('git rev-parse --absolute-git-dir', { cwd: top }).stdout.trim();
const app = join(top, 'apps', 'sunset-spots');

// Only changes to the app's code count.
const status = sh('git status --porcelain --untracked-files=all -- apps/sunset-spots', { cwd: top }).stdout;
const changed = status
  .split('\n')
  .map((l) => l.slice(3).trim().replace(/^"|"$/g, ''))
  .map((p) => (p.includes(' -> ') ? p.split(' -> ')[1] : p))
  .filter((p) => WATCHED.test(p));
if (changed.length === 0) process.exit(0);

if (!existsSync(join(app, 'node_modules'))) {
  out({ systemMessage: 'Spotlight quality gate skipped: run npm.cmd install in apps/sunset-spots first.' });
  process.exit(0);
}

// Fingerprint of the exact state being checked.
const hash = createHash('sha1');
hash.update(sh('git diff HEAD -- apps/sunset-spots', { cwd: top }).stdout);
for (const p of changed.sort()) {
  const f = join(top, p);
  if (existsSync(f)) hash.update(p).update(readFileSync(f));
}
const fp = hash.digest('hex');
const okFile = join(gitDir, 'spotlight-gate.ok');
const triesFile = join(gitDir, 'spotlight-gate.tries');
if (existsSync(okFile) && readFileSync(okFile, 'utf8').trim() === fp) process.exit(0);

const steps = [
  ['tests', 'npm test'],
  ['typecheck', 'npm run typecheck'],
  ['lint', 'npx expo lint'],
];
for (const [name, cmd] of steps) {
  const r = sh(cmd, { cwd: app, env: { ...process.env, EXPO_OFFLINE: '1', CI: '1' } });
  if (r.status === 0) continue;

  let tries = {};
  try {
    tries = JSON.parse(readFileSync(triesFile, 'utf8'));
  } catch {
    /* first failure */
  }
  const n = (tries[fp] ?? 0) + 1;
  writeFileSync(triesFile, JSON.stringify({ [fp]: n }));
  const tail = `${r.stdout ?? ''}\n${r.stderr ?? ''}`.trim().split('\n').slice(-60).join('\n');
  if (n > MAX_BLOCKS) {
    out({ systemMessage: `Spotlight quality gate: ${name} still fails after ${MAX_BLOCKS} attempts. Not blocking; the manager must review before merging.` });
    process.exit(0);
  }
  process.stderr.write(
    `Spotlight quality gate: ${name} failed (\`${cmd}\` in apps/sunset-spots), attempt ${n}/${MAX_BLOCKS}.\n` +
      `Fix it before finishing. Changed files: ${changed.join(', ')}\n\n${tail}\n`,
  );
  process.exit(2);
}

writeFileSync(okFile, fp);
out({ systemMessage: 'Spotlight quality gate: tests, typecheck and lint pass.' });
