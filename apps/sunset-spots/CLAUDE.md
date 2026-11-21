# Spotlight — אפליקציית מקומות שקיעה

הפרויקט הזה עומד בפני עצמו: כל מה שקשור ל־Spotlight נמצא בתיקייה הזו. אין כאן שום קשר לרעיונות האחרים של המשתמש/ת.

- **שפה:** לענות בעברית.
- **הקונטקסט:** `project/BRIEF.md` הוא הזיכרון של הפרויקט: הרעיון, ההחלטות, מצב ומה נשאר, ויומן בנייה. לקרוא אותו בתחילת עבודה, ולעדכן בו שורה בסוף כל סבב.
- **קוד:** `src/` (האפליקציה), `tests/`, `docs/` (צילומי מסך), `project/mockup/` (מוקאפ ראשוני).
- **אל תשמור/י מידע אישי בפרויקט** (מיקום מגורים, סכומי כסף, מפתחות). מפתחות (למשל Mapbox) נשמרים ב־`.env.local`, שלא עולה לגיטהאב.
- **בדיקות לפני כל דחיפה:** `npm test`, `npm run typecheck`, `EXPO_OFFLINE=1 CI=1 npx expo lint`.

- **הרצה בטלפון:** בכל פעם שהמשתמש/ת רוצה להריץ או לבדוק את האפליקציה, או חוזר/ת לעבוד עליה, להפעיל את ה־Skill `/phone-test` (`.claude/skills/phone-test/SKILL.md`, בתיקייה הזו) ולשלוח מיד את פקודות ההרצה. הפקודות מיועדות ל־PowerShell רגיל, לא כמנהל, במחשב הנייד עם Windows:
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
