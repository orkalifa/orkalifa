---
name: sprint
description: Run a Spotlight (apps/sunset-spots) sprint from the repo root - plan, route each task to the best model, dispatch, review, integrate, ship, retro. Use when the user says "start sprint", "/sprint", "next sprint", "ספרינט", asks what the Spotlight team should do next, or when all of a sprint's workers have reported.
---

# /sprint from the repo root

The real playbook lives in the app. This entry point only lets the user start it from here.

1. Read `apps/sunset-spots/CLAUDE.md` and `apps/sunset-spots/.claude/skills/sprint/SKILL.md`, then follow that skill exactly. Its rules win over this file.
2. Paths in it are relative to `apps/sunset-spots`. Run its commands from there (for example `cd apps/sunset-spots && node .claude/skills/sprint/pick-gemini.mjs ...`), or use absolute paths.
3. Work only on Spotlight in this session. Other ideas in the repo stay out of it.
4. Keep the manager lean (section 1b there): one sprint per session. When a sprint ships, tell the user to type `/clear` and then `/sprint` for the next one.
