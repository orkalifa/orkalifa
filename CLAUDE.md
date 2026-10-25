# orkalifa

הריפו הזה משמש כמאגר רעיונות ופרויקטים: קוד ואפליקציות, עסקי ואסטרטגי, ואוטומציות.

- **שפה:** לענות בעברית.
- **רעיון חדש:** בכל פעם שמובא רעיון חדש, להפעיל את ה־Skill `/idea` (`.claude/skills/idea/SKILL.md`).
- **מאגר:** כל ה־Idea Briefs נמצאים ב־`ideas/`, והאינדקס ב־`ideas/README.md`. לעדכן סטטוס כשעובדים על רעיון.
- **פורמט ברירת מחדל:** Markdown, אלא אם התוצר דורש פורמט אחר.
- **הרצת אפליקציית השקיעות בטלפון:** בכל פעם שהמשתמש/ת רוצה להריץ או לבדוק את האפליקציה, או חוזר/ת לעבוד עליה, לשלוח מיד את פקודות ההרצה. הפקודות מיועדות ל־PowerShell רגיל, לא כמנהל, ב־Windows:
  ```
  cd $HOME\orkalifa\apps\sunset-spots
  git pull
  npm install
  npx expo start -c
  ```
  - **אפשרות קצרה יותר:** לחיצה כפולה על `apps\sunset-spots\start.bat`.
  - **פעם ראשונה במחשב חדש:**
    1. `git clone https://github.com/orkalifa/orkalifa.git`
    2. `git checkout claude/claude-improvement-ideas-2rof6t`
    3. אם npm חסום ("running scripts is disabled"), להריץ `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
  - **בטלפון:** Expo Go, באותה רשת Wi‑Fi כמו המחשב. אם החיבור לא מצליח, להריץ `npx expo start --tunnel`.
  - **לא לעדכן ל־SDK 58** עד ש־Expo Go ב־Play Store יתמוך בגרסה הזו.
