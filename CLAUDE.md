# orkalifa

הריפו הזה משמש כמאגר רעיונות ופרויקטים: קוד ואפליקציות, עסקי ואסטרטגי, ואוטומציות.

- **שפה:** לענות בעברית.
- **רעיון חדש:** בכל פעם שמובא רעיון חדש, להפעיל את ה־Skill `/idea` (`.claude/skills/idea/SKILL.md`).
- **מאגר:** כל ה־Idea Briefs נמצאים ב־`ideas/`, והאינדקס ב־`ideas/README.md`. לעדכן סטטוס כשעובדים על רעיון.
- **פורמט ברירת מחדל:** Markdown, אלא אם התוצר דורש פורמט אחר.
- **הרצת אפליקציית השקיעות (Spotlight) בטלפון:** בכל פעם שהמשתמש/ת רוצה להריץ או לבדוק את האפליקציה, או חוזר/ת לעבוד עליה, להפעיל את ה־Skill `/phone-test` (`.claude/skills/phone-test/SKILL.md`) ולשלוח מיד את פקודות ההרצה. הפקודות מיועדות ל־PowerShell רגיל, לא כמנהל, במחשב הנייד עם Windows:
  - קודם `Ctrl+C`, אם שרת ישן עדיין רץ.
  - אחר כך שורה אחת בכל פעם, עם מקלדת באנגלית:
    ```
    cd $HOME\orkalifa\apps\sunset-spots
    git checkout -- package.json package-lock.json
    git pull
    npm.cmd install
    npx.cmd expo start --tunnel ngrok -c
    ```
  - **למה ככה:**
    - `npm.cmd` ו־`npx.cmd`, כי `npx` הרגיל נכשל שם עם `unknown option: -n`.
    - `--tunnel ngrok`, כי זה החיבור שעובד. ngrok מותקן כחלק מהפרויקט.
    - `git checkout --` לפני `git pull`, כי npm משנה לפעמים את קבצי החבילות ואז `git pull` נתקע.
  - **אפשרות קצרה יותר:** לחיצה כפולה על `apps\sunset-spots\start.bat`.
  - **פעם ראשונה במחשב חדש:**
    1. `git clone https://github.com/orkalifa/orkalifa.git`
    2. `git checkout claude/claude-improvement-ideas-2rof6t`
    3. אם npm חסום ("running scripts is disabled"), להריץ `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
  - **בטלפון:**
    - סוגרים את Expo Go לגמרי וסורקים את קוד ה־QR החדש.
    - לא נכנסים דרך "Recently opened", כי זה יכול להתחבר לשרת ישן.
  - **גרסה:** הפרויקט על Expo SDK 58, כמו Expo Go ב־Play Store. אם Expo Go אומר שהגרסאות לא תואמות, מתאימים את הפרויקט לגרסה של Expo Go, ולא להפך.
