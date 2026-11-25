---
name: sprint
description: The Spotlight manager playbook - plan, route each task to the best model, dispatch, review, integrate, ship, retro. Use when the user says "start sprint", "/sprint", "next sprint", asks what the team should do next, or when all of a sprint's workers have reported.
---

# /sprint - manager loop for the Spotlight team

You are the manager. The whole point of the role is to put every task on the model that does it best, then guarantee quality. Start by reading `project/TEAM.md` (current state only; history is in `project/archive/`) and `project/MODELS.md`. Read `project/LESSONS.md` only at retro time - its rules are already folded into this skill and the spec template.

## 1. Plan - with the routing gate
- Choose tasks: highest user value first; respect the user's decisions; group by files so parallel tasks never touch the same file (same file -> sequential). Max ~4 workers at once.
- **Routing gate (mandatory, never skip).** For EVERY task write a row: task | owner | provider + model + effort | why. The ONLY source is the table `## הניתוב` in `project/MODELS.md` (quality first; one cross-family reviewer per sensitive diff, no duplicate reviews; Fable only with the user's explicit OK). Never default every worker to the same model. Pass `--model <id> --effort <level>`. Quick checks per task: needs an image? Google/X facts? a formula? a sensitive diff (security, privacy, storage, untrusted input, service worker, deploy)? -> the matching row. A "user decision" blocked on missing options -> produce the options first, then ask.
- Also scan the backlog and open decisions for anything an external model can unblock now, and start it in the same wave.
- Write the routing table into the sprint section of TEAM.md and show it to the user.

## 1a. Routing research (once, properly, then kept fresh - do it without being asked)
- Evidence order: (1) our own results in `project/ROUTING-SCORECARD.md`, (2) authoritative sources (vendor model cards/docs, Artificial Analysis, official leaderboards), (3) blogs only as hints. Never change routing on a single benchmark; weigh cost per completed task (price x tokens).
- Run the literature part on other providers' budgets (Gemini Carbon, Grok with web access: `--allow Fetch --allow WebSearch --deny Bash --deny Edit --deny Write`), two independent sources, then reconcile them yourself.
- Re-run when: a new model id appears in `pick-gemini.mjs` `available`, a scorecard row shows 2+ fix rounds for a task type, or a month has passed.
- Budget the Gemini weekly quota (Individual plan): Neon/Carbon only where they add something (design, deep research); avoid xhigh unless it matters.
- **Checkpoint for the 2026-11-25 table (agreed with the user):** once ~10 tasks have run under it (scorecard section "טבלה 25.11"), review it without being asked: fix rounds per task type, real vs false reviewer findings, `usage.py` cost per finished task, fallbacks/account flips. Show the user what to keep, change or drop.
- After every task, add one scorecard row (model, fix rounds, reviewer findings) - free, and the best data we have.

## 1b. Usage discipline (tokens are limited) - measured, not guessed
- Measure each sprint: `python .claude/skills/sprint/usage.py` (cost per manager/worker session from local logs). 2026-11-25 baseline: the MANAGER conversation was 78% of all spend and 97.6% of tokens were cache re-reads; workers were 22%.
- Therefore the manager must stay lean: a fresh session per sprint, few turns, batch tool calls in one message, no status-only turns, no polling, read diff stats/risky hunks not whole files, let scripts do integration (one call).
- Workers: quality first - Opus for all real code (Sonnet is not cheaper per finished task: more tokens; lower quality). Haiku only for text/docs/mechanical work. Savings come from a lean manager and fewer rework rounds, never from a weaker coder.
- One sprint per manager session: when a sprint ships, the manager writes the board + BRIEF and the user starts a fresh session with `/sprint` (a long conversation re-reads its whole history every turn - the biggest cost).
- Plan phase only for M/L or sensitive tasks. Small, well-specified tasks (S, mechanical, Haiku) go straight to execution; the quality gate + manager review still apply.
- Creative variants: at most 2 in parallel (one Claude, one Gemini), on the best available tier - not 3-4.
- Offload to the other providers' budgets where they fit (Gemini, Codex, Grok have separate quotas); don't duplicate a review that one reviewer already covers.
- Review cheaply: read the diff stat + the risky hunks, small contact sheets instead of full screenshots, saved output files instead of re-running.

## 2. Dispatch
- Fill `project/templates/worker-spec.md` (house rules, domain pitfalls, definition of done), save it to the scratchpad, then:
  `orca orchestration worker-start --environment local --spec-file <f> --worktree name:team-<role> --agent claude --model <claude-sonnet-5-5|claude-opus-5-5|claude-haiku-5-5|claude-fable-5-2> --effort <low|medium|high|xhigh> --task-title "<id> ... (plan)" --json`
  Gemini: FIRST run `node .claude/skills/sprint/pick-gemini.mjs <creative|research|code|quick> --probe` (from apps/sunset-spots); exit code 1 = no usable Gemini right now (weekly quota exhausted or model missing) - do NOT dispatch, route elsewhere and tell the user when it resets. It asks Antigravity which models the account has right now and prints `pick`; use `--worktree name:team-gemini --agent antigravity --model <pick>` (no plan phase for non-code work). If it says `fallback: true`, tell the user which model runs instead of the preferred one BEFORE dispatching. Never pass a model id that isn't in `available`: in interactive mode Antigravity silently falls back to another model.
- After every start, verify the real model: Claude workers via process args (`--model`), Gemini via `orca orchestration worker-read --dispatch <id>` (the status line shows e.g. "Gemini 4 Hydrogen (High)").
- Start parallel workers from one shell command (see Orca's parallel-start reference), then end the turn; Orca wakes you.

## 3. Review - every plan, then every result
- Plan: verify its claims against the code (read the lines); check file ownership and conflicts; add missing pitfalls; approve with explicit corrections via `orca orchestration send --to dispatch:<id> --body-file <f>`.
- External checks (Codex/Grok): always run in the background with output written to a file (an interrupted foreground run loses the answer). Grok: include all needed code in the prompt and say "reasoning only, do NOT run tools".
- Hold a plan's approval when a parallel research task can change it (e.g. F1b waited for F1d).
- Result: read the diff yourself; rerun tests/typecheck in the worktree; run the required external check (Codex/Grok) in parallel; verify every external finding in the code before acting. Reject false ones with a reason; file marginal ones in the backlog; send real ones back as a NEW commit.
- A worker stuck on a permission prompt: don't approve risky commands for it; send the safe alternative.

## 4. Integrate and ship
- Trial-merge all branches into `integ/sprint<N>` in a temp worktree (junction node_modules from the main app), run tests/typecheck/lint, `EXPO_OFFLINE=1 CI=1 npm run build:web`, and a local smoke (`scripts/smoke-live.mjs` against a small static server on /orkalifa/).
- Summarize for the user: task -> what changed for the user, plus what the reviews caught. Ask to merge/push.
- After the push, watch the GitHub run (build, deploy, smoke) in the background and report.
- Clean up: remove the junction first, then the temp worktree (long-path safe: PowerShell `Remove-Item -LiteralPath "\\?\<path>"`), delete the integ branch.

## 5. Retro (always)
- 3-5 lines in `project/LESSONS.md`: what worked, what cost a round trip and why, which rule changes.
- Then change the template / this skill for real, so the lesson sticks.
- Update the BRIEF build log and TEAM.md statuses.
