# חלוקת עבודה בין המודלים
**מקור אחד לניתוב.** הסקיל `/sprint` מפנה לכאן. ההיסטוריה של ההחלטות נמצאת ב־git וב־`project/research/`. עודכן: 2026-11-25.

## עקרונות
1. **איכות קודם** (כלל של המשתמש/ת). דרגה זולה מקבלים רק כשכרטיס הניקוד (`ROUTING-SCORECARD.md`) מראה 0 סבבי תיקון לאותו סוג משימה.
2. **Opus עושה כמעט הכול.** מודל חיצוני נכנס רק כשהוא מוסיף משהו: משפחה אחרת שסוקרת, Google או X, או תמונות.
3. **אין כפילות.** סוקר חיצוני אחד לכל diff רגיש. diff קטן ולא רגיש: המנהל ובדיקות בלבד. כל ממצא חיצוני הוא הצעה שהמנהל מאמת בקוד.
4. **מכסה חיצונית נגמרה? עוברים לגיבוי בטבלה** ולא מחכים. לא שולחים מפתחות או מידע אישי.

## כסף או טוקנים (נבדק 2026-11-25)
הכול רץ על **מנויים**, ואין חיוב לפי שימוש. ה־$ ב־`usage.py` הוא מחיר רשימה, וזה מדד יחסי לכמה מהמכסה נשרף, לא חשבון.
| ספק | איך מחובר | מה קורה כשנגמר |
|---|---|---|
| Claude Code | מנוי (Google Play). Extra usage פעיל, אבל **אין קרדיטים** | נחסמים עד האיפוס. **אם יוטענו קרדיטים, החריגה תעלה כסף אמיתי** |
| Codex | התחברות עם ChatGPT, בלי מפתח API | מכסת התוכנית |
| Grok | התחברות לחשבון x.ai, בלי מפתח API | מכסת התוכנית |
| Gemini (Antigravity) | חשבון Google, תוכנית Individual, מכסה שבועית | נגמרה. מתאפסת בערך ב־2026-12-01 |

**החיסכון הגדול:** שיחת המנהל היא 78% מהשימוש (קריאה חוזרת של ההיסטוריה). לכן: סשן חדש לכל ספרינט, וקריאת קבצים מינימלית (סעיף 1b ב־`/sprint`).

## הניתוב
| סוג משימה | ראשי | גיבוי | לא |
|---|---|---|---|
| קוד רגיש או מורכב (אחסון, פרטיות, פורמט קפדני, service worker, ארכיטקטורה) | **Opus 5.5 xhigh** | Opus high | Haiku, Sonnet, Grok, Codex כמבצע |
| פיצ'ר ו־UI מוגדרים | **Opus 5.5 high** (Sonnet יוצא יקר יותר לכל משימה שנפתרה) | Gemini Carbon high, כשיש מכסה | Haiku, Luna |
| בדיקות בלבד | **Opus 5.5 medium** | | Haiku |
| טקסט, תיעוד, שינוי מכני | **Haiku 5.5 medium**, עם הגדרת "סיום" חד־משמעית | Opus low | xhigh |
| עיצוב ויזואלי ואבות טיפוס | **2 גרסאות:** Opus xhigh וגם Gemini Neon xhigh (Neon ניצח אצלנו) | בלי מכסת Gemini: גרסה אחת של Opus עם הסקיל `frontend-design` | Grok, Haiku |
| סקירת diff רגיש | **Codex terra high** (6 מתוך 9 ממצאים היו אמיתיים) | Gemini Carbon. Opus xhigh אם Gemini כתב את הקוד | המודל שכתב, או סוקר שני "ליתר ביטחון" |
| נוסחה ומתמטיקה | **Opus xhigh מיישם, עם בדיקות שרצות.** אימות נפרד: Gemini Neon | **Grok 4.7 high** (2 מתוך 2 נכונים אצלנו) | Grok כמאמת יחיד, בלי בדיקות |
| מחקר ברשת | **Grok 4.7 high** שולף (web ו־X), **Opus** מאמת מקורות | Gemini Carbon למחקר עמוק עם Google, ו־Flash לבדיקה מהירה | תשובה מהזיכרון בלי מקורות |
| טקסט משפטי | **Opus xhigh**, ממקורות ש־Grok שולף. בעל מקצוע מאשר | | Gemini |
| עברית בממשק | **Opus 5.5** | | GPT-OSS, Luna |
| תמונות | **Nano Banana** (Antigravity) | Canva, או המשתמש/ת באפליקציית Gemini מפרומפט שהמנהל כותב | מודל טקסט |
| תזמור | **Opus 5.5** (המנהל) | | Gemini Orchestrator (המבצע תמיד Hydrogen) |
| Claude Code הגיע למכסה | Claude דרך Antigravity: בחשבון osh… יש Opus ו־Sonnet 5.5. בחשבון ork… רק 4.6, שהם ישנים יותר | | Fable (לא בתוכנית, רק באישור מפורש) |

**שלב תוכנית** רק למשימות M/L או רגישות. **רמות מאמץ:** low למכני, medium לרגיל, high לרגיש, xhigh לקשה באמת.

## זמינות
- **Claude:** Opus, Sonnet ו־Haiku 5.5. Fable 5.2 לא כלול בתוכנית מאז 16.11.
- **Gemini דרך Antigravity בלבד** (`agy`). ה־Gemini CLI הופסק למשתמשים פרטיים. הזמינות משתנה (ב־25.11 נשארו רק Hydrogen ו־Flash), **כל חשבון Google מקבל רשימת מודלים ומכסה משלו** (ב־25.11 ב־osh… היו כל Gemini 4 ו־Claude 5.5, וב־ork… רק Hydrogen, Flash ו־Claude 4.6). לכן **תמיד** מריצים קודם `node .claude/skills/sprint/pick-gemini.mjs <creative|research|code|math|quick> --probe`. הסקריפט מדווח גם על החשבון, ונכשל אם הוא לא osh…. אם יוצא `fallback: true`, אומרים למשתמש/ת לפני השליחה.
- **Codex:** `gpt-5.6-terra` לסקירה. `gpt-6-luna` לסקירה מהירה של diff קטן. `gpt-reserve` לא בשימוש.
- **Grok:** `grok-4.7`.

## פקודות
| מה | פקודה |
|---|---|
| עובד Claude | `orca orchestration worker-start ... --agent claude --model claude-opus-5-5 --effort high` |
| עובד Gemini | `--worktree name:team-gemini --agent antigravity --model <pick>` |
| סקירת Codex (ברקע, לקובץ) | `git diff ... \| codex exec -m gpt-5.6-terra -c model_reasoning_effort=high --skip-git-repo-check -` (הוא לא מריץ פקודות כאן, ולכן ה־diff ב־stdin) |
| Grok, נימוק בלבד (ברקע, לקובץ) | `grok -p "<code + cases> Answer from reasoning only, do NOT run tools" -m grok-4.7 --effort high` |
| Grok עם רשת | להוסיף `--allow Fetch --allow WebSearch --deny Bash --deny Edit --deny Write` |
| תמונה | `agy -p "<prompt>" --model <pick> --mode accept-edits --print-timeout 0`. הקובץ נשמר ב־`~/.gemini/antigravity-cli/brain/<id>/` |
