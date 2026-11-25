# חלוקת עבודה בין המודלים
**מקור אחד לניתוב.** הסקיל `/sprint` מפנה לכאן. עודכן: 2026-11-25.
**על מה זה מבוסס:** שני מחקרים בלתי תלויים, של Grok (`research/model-routing-grok.md`) ושל Gemini Carbon (`research/model-routing-carbon.md`), שאישר כמעט כל מספר של Grok מול המקורות. ועוד התוצאות שלנו מכ־20 משימות (`ROUTING-SCORECARD.md`). כשהמחקר והתוצאות שלנו חלוקים, התוצאות שלנו קובעות.

## עקרונות
1. **איכות קודם.** דרגה זולה רק כשכרטיס הניקוד מראה 0 סבבי תיקון לאותו סוג משימה.
2. **כל מודל במה שהוא הכי טוב בו**, ולכל תפקיד יש ראשי, גיבוי 1 וגיבוי 2.
3. **סוקר חיצוני אחד** לכל diff רגיש, ממשפחה אחרת מזו שכתבה את הקוד. אין סקירה כפולה.
4. **כל תוצר חיצוני הוא הצעה** שהמנהל מאמת. לא שולחים מפתחות, מידע אישי או מיקום אמיתי.

## 1. כרטיס לכל מודל
| מודל | חזק ב | חלש ב | מאמץ | הערות |
|---|---|---|---|---|
| **Claude Opus 5.5** | קוד אגנטי (65.8% ב־Terminal-Bench, מקום 2), עיצוב web (מקום 2 ב־WebDev), הכי מעט הזיות בטקסט משפטי (0.59), עברית | צורך הרבה מכסה | xhigh לקשה, high לרגיל, medium לבדיקות | המנהל, והמבצע הראשי |
| **Claude Sonnet 5.5** | קרוב ל־Opus בקוד ובעיצוב (63.9%, WebDev 1773), מהיר | קיצורי דרך בשינוי רחב, ו־max מנפח טוקנים | high או medium, **אף פעם לא max** | גיבוי ראשון לקוד |
| **Claude Haiku 5.5** | משימות קטנות, זול פי 20 עד 40 מ־Opus | UI וארכיטקטורה (40%) | medium | שינוי מכני וטקסט |
| **Gemini 4 Neon** | הכי חכם בכללי (מדד 62), **הכי מעט המצאות עובדות** (11%), מתמטיקה, עיצוב (1765), עברית ו־RTL | הזיות בטקסט משפטי ארוך (2.50) | high, ו־xhigh לקשה | ניצח אצלנו בעיצוב |
| **Gemini 4 Carbon** | קוד (64.5%), מחקר עמוק, ראייה (תרשימים וגיאומטריה), סקירת אבטחה | **האיטי ביותר** (20 עד 40 דק'), שורף הכי הרבה מכסה | **רק high** (xhigh מחזיר שגיאה) | סוקר ממשפחה אחרת |
| **Gemini 4 Hydrogen** | מהיר וזול, מעט המצאות (8.5%) | מתכנן חלש. ב־low קורס | high או xhigh, לא low | מחליף את Flash |
| **Gemini 4 Argon** | | **נחות מ־Neon בכל מדד** (50 מול 62, יותר הזיות) | | **לא בשימוש** |
| **Gemini 3.8 Flash** | זול | ממציא 55% מהזמן כשהוא לא יודע | | **לא בשימוש** (Hydrogen עדיף) |
| **Gemini Orchestrator** | | מבצע תמיד על Hydrogen, נכנס ללולאות ושורף מכסה | | **לא בשימוש** |
| **Nano Banana 2.1** | התמונות הכי טובות של Google (מקום 9 ב־Arena), 2 עד 4 שניות | טקסט עברי בתוך תמונה יוצא משובש | | ברירת המחדל של Antigravity היא גרסה 2, ולכן מבקשים 2.1 במפורש |
| **Codex gpt-5.6-terra** | סוקר טוב אצלנו (6 מתוך 9 ממצאים אמיתיים) | חלש כסוכן (21.5%), ממציא כשהוא לא יודע | high | ⚠️ **יוצא משימוש ב־2026-12-23** |
| **Codex gpt-6-luna** | זול ומהיר | חלש מאוד (15%), "TODO" עצלן | low או medium | גיבוי אחרון לשינוי מכני |
| **Codex gpt-reserve** | | זה לא מודל נפרד, אלא גיבוי אוטומטי של Codex כשהמכסה נגמרת | | **לא בשימוש** |
| **Grok 4.7** | **היחיד עם חיפוש חי ב־X וברשת**, דירוג טוב בטקסט משפטי | קוד (38.8%), UI, עברית, ו־xhigh מנפח טוקנים | high | שליפה בלבד. בלי מידע אישי (תנאי ה־DPA של xAI) |
| **gpt-oss-120b** | | מדד 4, ממציא 87% מהזמן, לא רואה תמונות | | **לא בשימוש** |
| **Claude 5.5 דרך Antigravity** | אותו מודל, על מכסה נפרדת של Google | המכסה קטנה ונגמרת מהר ב־Opus | | גיבוי למכסת Claude Code בלבד |

## 2. הניתוב
| סוג משימה | ראשי | גיבוי 1 | גיבוי 2 | לא |
|---|---|---|---|---|
| **קוד רגיש** (פרטיות, מיקום, אחסון, פורמט קפדני, service worker, פריסה) | Opus xhigh | Gemini Carbon high | Gemini Neon xhigh | Luna, Terra, Grok, Haiku |
| **פיצ'ר ו־UI מוגדרים** | Opus high | Sonnet high | Gemini Neon high | Sonnet max, Luna, gpt-oss |
| **בדיקות** | Opus medium | Gemini Neon high | Sonnet high | Grok, Luna |
| **שינוי מכני, טקסט, תיעוד** | Haiku medium | Gemini Hydrogen high | Codex Luna medium | Opus או Carbon (בזבוז), Flash |
| **עיצוב ואבות טיפוס** | **2 גרסאות:** Opus xhigh וגם Gemini Neon xhigh | Gemini Carbon high | Sonnet high | Haiku, Grok, gpt-oss |
| **סקירת קוד** (ממשפחה אחרת) | **עד 23.12:** Codex terra high. **מ־23.12:** Gemini Carbon high | Gemini Carbon high, ואחרי 23.12 Neon xhigh | Opus xhigh בסשן נפרד, בלי ההקשר של הכותב | מודל מאותה משפחה, Luna, Flash |
| **נוסחה ומתמטיקה** | Opus מיישם עם בדיקות שרצות, ו־**Gemini Neon xhigh מאמת** עם קוד | Gemini Carbon high | Grok high (2 מתוך 2 נכונים אצלנו) | חישוב "בראש" בלי קוד, gpt-oss |
| **מחקר ברשת** (תיעוד, SDK, חנויות, תנאים) | Gemini Neon high, עם חיפוש Google | Gemini Carbon high, למחקר עמוק | Grok high | Terra, Luna, Flash, תשובה מהזיכרון |
| **מה אומרים ב־X ובקהילה** | Grok high | Gemini Neon high | Sonnet עם חיפוש | מודלים בלי חיפוש |
| **טקסט משפטי ופרטיות** | Opus xhigh, ממקורות ש־Neon או Grok שולפים | Grok xhigh כבודק שני (בלי מידע אישי) | Sonnet high | Argon, Carbon, Luna. **בעל מקצוע מאשר** |
| **עברית בממשק** | Opus high | Sonnet high | Gemini Neon high | Grok, Luna, gpt-oss |
| **תמונות** | Nano Banana 2.1 | Nano Banana 2 | Canva, או המשתמש/ת באפליקציית Gemini | טקסט עברי בתוך תמונה (מוסיפים אותו בקוד) |
| **תזמור ותכנון** | Opus (המנהל) | Claude 5.5 דרך Antigravity | Sonnet high | Gemini Orchestrator |

**שלב תוכנית** רק למשימות M/L או רגישות.

## 3. כשמשהו משתבש
| בעיה | איך מזהים | מה עושים |
|---|---|---|
| **מכסת Claude Code נגמרה** | שגיאת limit | Claude 5.5 דרך Antigravity (מכסה קטנה). אחר כך Sonnet. אחר כך עוצרים עד האיפוס |
| **מכסת Gemini נגמרה** | `pick-gemini.mjs --probe` נכשל או מחזיר `fallback` | עוברים לגיבוי בטבלה. **לא** עוברים לחשבון ork… |
| **Antigravity עבר לחשבון אחר** | הסקריפט מדווח `accountWarning` | עוצרים, והמשתמש/ת מחליף/ה בהגדרות Orca ל־osh… |
| **Codex או Grok לא זמינים** | שגיאה או מכסה | גיבוי 1 בטבלה, בלי לנסות שוב בלולאה |
| **שירות לא עונה (503 או timeout)** | שגיאה | ניסיון אחד נוסף אחרי כמה דקות, ואז גיבוי 1 |
| **תוצר חלש** | 2 סבבי תיקון | מעלים דרגה (high ל־xhigh, או Sonnet ל־Opus) או מחליפים משפחה, ורושמים בכרטיס הניקוד |
| **מודל יוצא משימוש** | הודעת ספק או `models_cache` | Terra ב־23.12: Carbon נהיה הסוקר הראשי |

## 4. מכסות
- **הכול מנוי, בלי חיוב לפי שימוש.** ה־$ ב־`usage.py` הוא רק מדד לכמה מהמכסה נשרף.
  - **Claude:** מנוי דרך Google Play. ב־Extra usage אין קרדיטים, ולכן כשנגמר נחסמים ולא מחויבים. **אם יוטענו קרדיטים, החריגה תעלה כסף.**
  - **Codex:** ChatGPT. **Grok:** x.ai. **Gemini:** תוכנית Google בתשלום, בחשבון osh….
- **Gemini:** יש חלונות של 5 שעות בתוך מכסה שבועית. סשן כבד אחד של Neon xhigh או Carbon יכול לשרוף 30% עד 50% מהשבוע. לכן xhigh רק כשצריך, Carbon רק לעומק, וכל השאר על Hydrogen.
- **Claude:** המנהל הוא 78% מהשימוש. סשן חדש לכל ספרינט.
- **פרטיות (החלטה של המשתמש/ת):** בתוכניות פרטיות, כל הספקים משתמשים בפרומפטים לאימון כברירת מחדל, אלא אם מבטלים בהגדרות של כל כלי.

## 5. זמינות ופקודות
- **Gemini דרך Antigravity בלבד.** כל חשבון Google מקבל מודלים ומכסה משלו. **תמיד** מריצים קודם `node .claude/skills/sprint/pick-gemini.mjs <creative|research|deep|code|math|quick> --probe`. הסקריפט בוחר את הטוב ביותר שזמין, מדווח על החשבון, ונכשל אם הוא לא osh…. אם יוצא `fallback: true`, אומרים למשתמש/ת לפני השליחה.

| מה | פקודה |
|---|---|
| עובד Claude | `orca orchestration worker-start ... --agent claude --model claude-opus-5-5 --effort high` |
| עובד Gemini | `--worktree name:team-gemini --agent antigravity --model <pick>` |
| סקירת Codex (ברקע, לקובץ) | `git diff ... \| codex exec -m gpt-5.6-terra -c model_reasoning_effort=high --skip-git-repo-check -` |
| Grok, נימוק בלבד (ברקע, לקובץ) | `grok -p "<code + cases> Answer from reasoning only, do NOT run tools" -m grok-4.7 --effort high` |
| Grok עם רשת | להוסיף `--allow Fetch --allow WebSearch --deny Bash --deny Edit --deny Write` |
| תמונה | `agy -p "<prompt, use Nano Banana 2.1>" --model <pick> --mode accept-edits --print-timeout 0`. הקובץ נשמר ב־`~/.gemini/antigravity-cli/brain/<id>/` |
