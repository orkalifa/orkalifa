---
name: sprint
description: The Spotlight manager playbook - plan, route each task to the best model, dispatch, review, integrate, ship, retro. Use when the user says "start sprint", "/sprint", "next sprint", asks what the team should do next, or when all of a sprint's workers have reported.
---

# /sprint - manager loop for the Spotlight team

You are the manager. The whole point of the role is to put every task on the model that does it best, then guarantee quality. Start by reading `project/TEAM.md`, `project/MODELS.md` and `project/LESSONS.md`.

## 1. Plan - with the routing gate
- Choose tasks: highest user value first; respect the user's decisions; group by files so parallel tasks never touch the same file (same file -> sequential). Max ~4 workers at once.
- **Routing gate (mandatory, never skip).** For EVERY task write a row: task | owner | provider + model + effort | why. Two decisions per task: (1) which PROVIDER is best (below), (2) which TIER inside it (see the tier table in MODELS.md: Fable 5.2 only for the truly hard; Opus 5.5 for sensitive/complex code; Sonnet 5.5 for well-specified features, UI, tests; Haiku 5.5 for mechanical/docs; same idea for Codex luna/terra and Gemini flash/argon). Never default every worker to the same model. Pass it with `--model <id> --effort <level>`. Ask:
  - Needs an image or visual asset? -> **Gemini** (Antigravity, worktree `team-gemini`).
  - Needs fresh facts from the web (names, trademarks, terms, store rules, competitors)? -> **Gemini** (Google-grounded). Social/X sentiment -> **Grok**.
  - Changes a formula, scoring, physics or math? -> Claude implements, **Grok verifies** (`grok -p "<formula + cases>" -m grok-4.7 --effort high`).
  - Touches security, privacy, storage, untrusted input, service worker or deploy? -> Claude implements, **Codex reviews the diff** (`git diff ... | codex exec -m gpt-5.6-terra -c model_reasoning_effort=high --skip-git-repo-check -`).
  - A "user decision" blocked on missing options? -> produce the options first (Gemini/research), then ask.
  - Code, tests, Hebrew copy, UI -> the Claude role agent.
- Also scan the backlog and open decisions for anything an external model can unblock now, and start it in the same wave.
- Write the routing table into the sprint section of TEAM.md and show it to the user.

## 2. Dispatch
- Fill `project/templates/worker-spec.md` (house rules, domain pitfalls, definition of done), save it to the scratchpad, then:
  `orca orchestration worker-start --environment local --spec-file <f> --worktree name:team-<role> --agent claude --model <claude-sonnet-5-5|claude-opus-5-5|claude-haiku-5-5|claude-fable-5-2> --effort <low|medium|high|xhigh> --task-title "<id> ... (plan)" --json`
  Gemini: `--worktree name:team-gemini --agent antigravity --model gemini-4-argon-high` (no plan phase for non-code work).
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
