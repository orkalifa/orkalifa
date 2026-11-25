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

## צוות הסוכנים
- **הסשן הראשי הוא המנהל.** הוא קורא את `project/TEAM.md`, מחלק משימות לסוכנים, מתאם שינויים שנוגעים בכמה תחומים, בודק את מה שחוזר (בדיקות, typecheck, lint, וגם קריאה של ה־diff), מעדכן את הלוח ואת ה־BRIEF, ומבצע commit ו־push רק באישור המשתמש/ת.
- **חברי הצוות** מוגדרים ב־`.claude/agents/`: `map-data`, `sun-engine`, `ui-ux`, `user-data`, `release`. כל אחד עובד רק על הקבצים שלו.
- **משימות במקביל** שנוגעות בקבצים שונים יכולות לרוץ יחד. אם שתי משימות נוגעות באותו קובץ (בעיקר `src/app/index.tsx`), הן רצות אחת אחרי השנייה.
- **החלטות של המשתמש/ת** (שם, אייקון, חשבונות, כסף) לא נסגרות על ידי סוכן. המנהל מרכז אותן ושואל.

### תהליך העבודה: המנהל מאשר לפני ובודק אחרי
1. **תוכנית (קריאה בלבד, רק למשימות M/L או רגישות):** הסוכן מקבל משימה מהלוח ומחזיר תוכנית: אילו קבצים ישתנו, מה בדיוק ישתנה, איך יבדוק, ומה הסיכונים. בשלב הזה הוא לא נוגע בקבצים.
2. **אישור המנהל:** המנהל קורא את התוכנית מול הקוד ומוודא שהיא בתחום של הסוכן, לא מתנגשת עם משימה אחרת ולא דורשת החלטה של המשתמש/ת. אם יש בעיה, התוכנית חוזרת לתיקון. רק אחרי אישור הסוכן מבצע (ממשיך מאותו הקשר).
3. **ביצוע:** הסוכן מבצע את מה שאושר, ורק את זה. סטייה מהתוכנית דורשת אישור חדש.
4. **בדיקת המנהל:** המנהל קורא את כל ה־diff ומריץ בעצמו `npm test`, `npm run typecheck` ו־lint. הוא מעביר את ה־diff לסוקר שני לפי `project/MODELS.md`, ומאמת כל ממצא בקוד. מה שלא עובר חוזר לסוכן.
5. **הצגה למשתמש/ת:** רק מה שעבר את הבדיקה מוצג, עם סיכום קצר. commit ו־push רק באישור.
- **אין עבודה יתומה.** כל משימה מסתיימת ב־commit על הענף של הסוכן, והמנהל ממזג או דוחה עם סיבה. עבודה לא שומרים רק בתיקייה. (הלקח מ־Antigravity: 1,500 שורות ישבו 3 ימים בלי commit ובלי מיזוג, והקוד התקדם בלעדיהן.)
- **משימות קטנות.** משימה אחת נוגעת במעט קבצים וממוזגת באותו יום. שינוי רוחבי (למשל ערכת צבעים לכל המסכים) מתפרק לשלבים שכל אחד מהם ממוזג בנפרד.
- **ה־playbook של המנהל:** `/sprint` (`.claude/skills/sprint/SKILL.md`): תכנון עם שער ניתוב, שליחה, בדיקה, מיזוג ניסיון, שחרור ורטרו. תבנית המפרט: `project/templates/worker-spec.md`. הלקחים: `project/LESSONS.md`. כל ספרינט עובר את כל השלבים.
- **ניתוב יזום למודלים אחרים (חובה בתכנון כל ספרינט):** המנהל עובר על כל משימה בלוח מול `project/MODELS.md`, ומציע בעצמו מה עובר ל־Gemini (תמונות, מחקר עם Google), ל־Codex (סקירה שנייה) או ל־Grok (שליפה מהרשת ומ־X, ואימות נוסף לנוסחאות). לא מחכים שהמשתמש/ת ישאל/תשאל. הלקח מ־2026-11-24.
- **חבר צוות Gemini:** ה־worktree `team-gemini` (ענף `team/gemini`), דרך Antigravity (`orca orchestration worker-start --agent antigravity --model <pick>`, כשה־pick מגיע מ־`pick-gemini.mjs --probe`). עבודה שאינה קוד (תמונות, מחקר) לא צריכה שלב תוכנית. המנהל בודק כל תוצר לפני שמשתמשים בו.
- **גם תשובות של מודלים חיצוניים** (Codex, Gemini, Grok) עוברות דרך המנהל. הן הצעות, לא החלטות.

### Worktrees ב־Orca
- **המנהל:** הסשן בריפו הראשי (`C:\Users\or\orkalifa`, ענף `claude/claude-improvement-ideas-2rof6t`).
- **כל חבר צוות:** worktree משלו מתחת למנהל, `C:\Users\or\orca\workspaces\orkalifa\team-<role>`, על ענף `team/<role>`. התפקידים: map-data, sun-engine, ui-ux, user-data, release.
- **המשימות:** המנהל שולח משימה ל־worktree דרך `orca orchestration worker-start`, בודק את מה שחזר וממזג לענף הראשי. הסוכן עובד רק בתוך ה־worktree שלו.
- **לפני כל משימה:** הסוכן ממזג אליו את הענף הראשי (`git merge claude/claude-improvement-ideas-2rof6t`) ומריץ `npm.cmd install` בתוך `apps/sunset-spots`.

### בדיקות אוטומטיות
- **שער איכות (Stop hook):** בכל פעם שסשן מסיים (המנהל או סוכן ב־worktree), אם יש שינויים שלא נשמרו ב־`src/`, `tests/`, `scripts/` או בקבצי ההגדרות של האפליקציה, רצים tests, typecheck ו־lint. אם משהו נכשל, הסשן לא מסתיים עד שהבעיה מתוקנת. אחרי 3 ניסיונות על אותו מצב השער משחרר עם אזהרה, והמנהל בודק. מצב שכבר עבר את הבדיקה נשמר ולא נבדק שוב. הסקריפט: `scripts/quality-gate.mjs`. ההוק מוגדר ב־`.claude/settings.json` של הריפו ושל האפליקציה.
- **בדיקה אחרי פריסה:** אחרי כל פריסה, job בשם `smoke` ב־GitHub Actions פותח את האתר החי ב־Chromium ובודק שהוא נטען בלי שגיאות, ששעת השקיעה והמקומות מוצגים, ושה־manifest וה־service worker זמינים. אם משהו נכשל, הריצה נכשלת ונשמר צילום מסך. הסקריפט: `scripts/smoke-live.mjs`. להרצה מקומית: `SMOKE_CHANNEL=chrome`, וגם `PLAYWRIGHT_DIR` אם Playwright מותקן מחוץ לפרויקט.

### טלפון וירטואלי (Android Emulator)
- **ה־SDK:** מותקן ב־`%LOCALAPPDATA%\Android\Sdk` (בלי הרשאות מנהל). ה־JDK נמצא ב־`%LOCALAPPDATA%\Android\jdk`. מכשיר וירטואלי בשם `spotlight` (Pixel 7, Android 35), עם האצת WHPX.
- **הפעלה:** `"$LOCALAPPDATA/Android/Sdk/emulator/emulator.exe" -avd spotlight -no-snapshot-save &`, ואחר כך `npx.cmd expo start --android` מתוך `apps/sunset-spots` (Expo Go מותקן אוטומטית).
- **צילום מסך:** `"$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe" exec-out screencap -p > docs/<name>.png`.
- **אם sdkmanager נכשל ב־SSL:** `SDKMANAGER_OPTS=-Djavax.net.ssl.trustStoreType=Windows-ROOT`.
