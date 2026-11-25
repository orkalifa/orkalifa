I'll look up current model cards and leaderboards for the exact model IDs you listed, then map each task type to a recommendation with sources.

The intelligence index is in. Next I’ll pull coding, agent, and cost pages so the matrix isn’t based on one score.

Chart pages hid the per-model scores. I’ll pull the official Terminal-Bench board, the remaining model cards, and the image and legal evals.

**Routing for this stack, as of 25 Nov 2026.** Prices below are API list cost per completed eval task, not sticker price per token. Claude Code and Antigravity are mostly quota-limited, so token burn matters as much as dollars. Claude Fable 5.2 is the public intelligence and WebDev leader and is out of plan.

Sources disagree on “best coder.” Use the harness you actually run.

| Task | Best | Runner-up | Avoid | Confidence |
|---|---|---|---|---|
| 1. Sensitive code | `claude-opus-5-5` **xhigh** (max only if xhigh fails) | `gemini-4-carbon` **high** | Sonnet **max**, Argon, Grok, Terra, Luna, Haiku, 3.8 Flash, `gpt-oss-120b` | High on the shortlist. Medium on Opus vs Carbon |
| 2. Specified feature / UI code | `gemini-4-carbon` **high** | `claude-sonnet-5-5` **xhigh** | Opus **max** for routine UI; Luna; Haiku; Terra | Medium |
| 3. Mechanical edits, docs, test-only | `claude-haiku-5-5` **low** or **medium** | `gpt-6-luna` **low** | Any **max/xhigh** frontier model; `gpt-oss-120b` | Medium |
| 4. Visual / UI prototypes | `claude-opus-5-5` **max** for HTML/CSS taste; `gemini-4-carbon` **high** when quota matters | `claude-sonnet-5-5` **xhigh** | Grok, Haiku, Luna, Terra for look-and-feel | Medium |
| 5. Review of a diff | The other family: Carbon **high** if Claude wrote it; Opus **xhigh** if Gemini wrote it | Neon **xhigh** | Same model that wrote the diff; Grok as the only reviewer; Luna; Terra | Medium |
| 6. Math / geometry / scoring | `gemini-4-neon` **xhigh**, with code execution | Carbon **high** or Opus **xhigh**, also executing code | Mental arithmetic from Grok, Luna, Terra, `gpt-oss-120b` | Medium |
| 7. Deep research and lookups | `grok-4.7` **high** to retrieve (web + X). **xhigh** does not raise its index | Opus **xhigh** to check the citations | Closed-book answers from Neon/Carbon/Argon; `gpt-oss-120b` | Medium |
| 8. Privacy policy / terms | Opus **xhigh**, drafting only from retrieved sources. A lawyer still owns it | Grok **high** to fetch the store/API pages, not to draft | Gemini 4 Argon/Carbon/Neon for text that must not invent obligations | High on the hallucination gap. Medium that the legal benchmark transfers to a privacy policy |
| 9. Hebrew UI copy | Opus or Sonnet **xhigh**, then a Hebrew speaker | Carbon **high** | `gpt-oss-120b`, Luna | **Low.** No current Hebrew board for these ids |
| 10. Icons / textures | **Nano Banana 2.1** | Nano Banana 2 | Nano Banana Pro; any LLM as the image model | High |
| 11. Orchestration | Opus **xhigh** or Carbon **high** as the planner. Workers: Hydrogen **high**, Haiku **medium** | Neon **high** | `gemini-pro-orchestrator`, `codex-auto-review`, `gpt-reserve` as unmeasured routers; Luna/Terra/`gpt-oss` as planners | Medium |

### Evidence that drives the table

**Agentic coding.** Official Terminal-Bench 4.1, native harnesses, [tbench.ai/leaderboard](https://www.tbench.ai/leaderboard): Opus 5.5 max on Claude Code **65.8% ± 3.1**, suite **$4.7k / 8.0B tokens** (22 Sep 2026 model). Carbon high on Antigravity **64.5% ± 3.2**, **$1.4k / 3.8B**. Those intervals overlap. Sonnet 5.5 max **63.9%** but **$7.3k / 19.4B**. Neon xhigh **61.2%**, **$1.9k**. Hydrogen high **56.4%**, **$0.8k**. Argon high **55.5%**, **$1.1k**. Haiku max **40%**, **$1.0k / 12.1B**. Grok 4.7 xhigh **38.8%**, **$3.7k**. GPT-5.6 Terra max **21.5%**. Gemini 3.8 Flash high **18.2%** (mini-SWE-agent, so the harness is not Antigravity). GPT-5.6 Luna **17.6%**. GPT-6 Luna **15.2%**, **$0.1k**. Rough list-price cost per resolved task is about **$33 for Carbon**, **$108 for Opus**, **$173 for Sonnet max**, **$145 for Grok**.

Artificial Analysis’s equal harness (mini-swe-agent) disagrees: Carbon high ties GPT-6.2 Astra xhigh at **66.2%**, behind Kimi K3.1 Pro at **68.2%** ([Terminal-Bench 4.1](https://artificialanalysis.ai/evaluations/terminalbench-4-1), fetched 25 Nov 2026). Opus is not in that top three. For this team the native-harness board is the one that matches Claude Code and Antigravity. [SWE-bench Verified](https://www.swebench.com/verified.html) published no current numeric table in the page fetched today, so it is not used. FrontierCode-AA 2.0’s top scores are Fable and Astra, both out of plan ([FrontierCode-AA 2.0](https://artificialanalysis.ai/evaluations/frontiercode-2-0)).

**Intelligence vs tokens.** AA Intelligence Index v5.0.2, fetched 25 Nov 2026: Neon xhigh **62**, **$6.44/task**, **$3 / $15** per 1M, released 18 Nov 2026 ([Neon](https://artificialanalysis.ai/models/gemini-4-neon)). Carbon high **60**, **$7.76**, **$4 / $20**, 28 Oct 2026, and slow (**38 min/task**) ([Carbon](https://artificialanalysis.ai/models/gemini-4-carbon)). Opus max **59**, **$10.04**, **$4 / $20**; xhigh is **58** with time-to-first-answer **78s vs 338s** at max ([Opus](https://artificialanalysis.ai/models/claude-opus-5-5)). Sonnet max **55** but **$10.02/task** on a **$2 / $10** card, because max emitted **335M** output tokens vs Opus **218M** ([Sonnet](https://artificialanalysis.ai/models/claude-sonnet-5-5)). Hydrogen xhigh **54**, **$3.16**, **$1.50 / $7.50** ([Hydrogen](https://artificialanalysis.ai/models/gemini-4-hydrogen)). Argon high **51**, **$9.95**, same **$4 / $20** as Carbon ([Argon](https://artificialanalysis.ai/models/gemini-4-argon)). Haiku max **37**, **$0.41**, **$0.10 / $0.50**, and very verbose at max ([Haiku](https://artificialanalysis.ai/models/claude-haiku-5-5)). Grok 4.7 xhigh **and high both 35**, **$7.77**, **$2 / $6**, 500k context ([Grok](https://artificialanalysis.ai/models/grok-4-7)). GPT-5.6 Terra max **32**, deprecated July 2026; AA points to GPT-6.1 Terra, which you do not have ([Terra](https://artificialanalysis.ai/models/gpt-5-6-terra)). GPT-6 Luna max **28**, **$0.15** ([Luna](https://artificialanalysis.ai/models/gpt-6-luna)). `gpt-oss-120b` high **4** ([leaderboard](https://artificialanalysis.ai/leaderboards/models)).

**Web UI preference.** WebDev Arena, 23 Nov 2026, 1.05M votes ([arena.ai/leaderboard/webdev](https://arena.ai/leaderboard/webdev)): Fable xhigh **1822** (out of plan). In plan: Opus max **1820**, **$8.99/task**; Sonnet xhigh **1773**, **$3.03**; Carbon high **1769**, **$1.61**; Neon xhigh **1765**, **$2.58**; Hydrogen xhigh **1701**, **$1.35**. The Opus–Fable gap is 2 points. The Opus–Carbon gap is about 50 points for roughly 5× the median task cost.

**Math.** CritPt v2 leaders are out of plan: Fable max **86.3%**, GPT-6 Astra medium **84.0%** ([CritPt v2](https://artificialanalysis.ai/evaluations/critpt-v2)). The in-plan order is inferred from the index, which includes CritPt’s hard subset. Run the formula in code.

**Legal.** Harvey LAB-AA v1.1 hallucination-gated all-pass is low for everyone ([Harvey LAB-AA](https://artificialanalysis.ai/evaluations/harvey-lab-aa)). In plan: Grok xhigh **9.4%** all-pass but **0.74** material hallucinations/task; Neon xhigh **5.8%** and **2.50**; Opus max **4.2%** and **0.59** at **$17.93/task**; Carbon **2.99**; Argon **3.82**. Criterion pass rates are all about 90%. The gate is what separates them. Judges include Opus and Grok; AA reports little self-preference.

**Images.** Arena text-to-image, 21 Nov 2026: Nano Banana 2.1 is **9th, Elo 1305, ~$0.05/image** ([arena](https://arena.ai/leaderboard/text-to-image)). AA-Image-T2I v2.1: 2.1 Elo **1175**, **$34/1k**; Banana 2 **1145**, **$67/1k**; Pro **1117**, **$134/1k** ([AA image board](https://artificialanalysis.ai/image/leaderboard/text-to-image)).

No public score was found for `gemini-pro-orchestrator`, `codex-auto-review`, or `gpt-reserve`.

### Five mistakes that are easy to lock in

1. **“Sonnet is the cheap Opus.”** At max effort it is not. Half the token price, more than twice the tokens, worse Terminal-Bench, and about **$173 vs $108** per resolved task. Sonnet’s useful setting is **xhigh**, not max.
2. **“Neon tops the index, so it should write the risky code.”** Index **62** vs Opus **59**. On Claude Code / Antigravity, Opus and Carbon match or beat Neon, and Carbon is the cheaper resolved task. AA’s shared harness also puts Carbon at the top, not Neon.
3. **“Argon is just another Gemini 4.”** Same **$4/$20** as Carbon, index **51 vs 60**, Terminal-Bench **55.5% vs 64.5%**, and the worst in-plan Harvey hallucination rate (**3.82/task**). Hydrogen high beats it for less money.
4. **“Grok 4.7 xhigh is a frontier coder.”** Index **35**, same as high, so xhigh buys tokens. Terminal-Bench **38.8%** at a worse cost per success than Haiku. Use it to fetch pages, then check with Opus. It hallucinates more than Opus on document-grounded legal work (**0.74 vs 0.59**).
5. **“Cheap per token means cheap per finished task.”** Terra is deprecated and resolves **21.5%**. Luna resolves **15%**. `gpt-oss-120b` scores **4**. A failed run is redone by Opus or Carbon, so the weak model is not the cost of the completed task. Fable is the model a leaderboard will tempt you to buy; it is not in the plan, and on Terminal-Bench Opus max already ties it at **65.8%** for about a quarter of Fable’s suite cost (**$4.7k vs $16.5k**).
