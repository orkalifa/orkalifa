---
name: phone-test
description: Run a phone test round of the Spotlight sunset app (apps/sunset-spots) — send the run commands, a short checklist, then turn the user's screenshots and feedback into fixes and a log entry. Use when the user types /phone-test, wants to run or check the app on their phone, says "אני ליד המחשב", or sends a screenshot from the app.
---

# /phone-test — סבב בדיקה של Spotlight בטלפון

המטרה: להגיע מ"אני ליד המחשב" לצילומי מסך ומשוב מהטלפון, עם כמה שפחות הודעות הלוך ושוב.

## 1. הכנה (אצלי, לפני ששולחים פקודות)
- לבדוק שאין שינויים שלא נדחפו (`git status`). אם יש, להריץ בדיקות ולדחוף לפני שהמשתמש/ת מריץ/ה `git pull`.
- אם נוספה חבילה מאז הסבב הקודם, להדגיש שהפעם `npm.cmd install` חובה.

## 2. לשלוח את פקודות ההרצה
הפקודות ל־PowerShell רגיל במחשב הנייד, שורה אחת בכל פעם:
```
cd $HOME\orkalifa\apps\sunset-spots
git checkout -- package.json package-lock.json
git pull
npm.cmd install
npx.cmd expo start --tunnel ngrok -c
```
- קודם `Ctrl+C`, אם שרת ישן עדיין רץ.
- המקלדת צריכה להיות באנגלית (`Alt+Shift`).
- בטלפון: סוגרים את Expo Go לגמרי וסורקים את קוד ה־QR החדש. לא נכנסים דרך "Recently opened".

## 3. תקלות שכבר ראינו
| מה מופיע | מה עושים |
|---|---|
| `running scripts is disabled` | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, או `npm.cmd` / `npx.cmd` |
| `unknown option: -n` או `>>` | `Ctrl+C`, ואז `npx.cmd` במקום `npx` |
| `Port 8081 is being used` | שרת ישן רץ בחלון אחר. לסגור את כל חלונות PowerShell |
| `Install @expo/ngrok and try again` | `npm.cmd install` (ngrok מותקן כחלק מהפרויקט) |
| `Couldn't create a signed tunnel URL` | חסר `ngrok` אחרי `--tunnel` |
| `incompatible with this version of Expo Go` | להתאים את הפרויקט ל־SDK של Expo Go (לא להפך), ולעדכן את `CLAUDE.md` |
| `Something went wrong` בטלפון | לבקש צילום של "View error log". בדרך כלל זה שרת ישן או רשת, ו־tunnel פותר |

## 4. צ'קליסט קצר (לשלוח אחרי שהאפליקציה עולה)
לשאול רק על מה שהשתנה מאז הסבב הקודם, ועוד:
1. המפה: רואים שדות, כבישים ושמות יישובים?
2. מקומות: יש סיכות ורשימה? אם מופיעה שגיאה, לצלם את השורה הקטנה באנגלית שמתחתיה.
3. מה שהשתנה בסבב הזה, למשל "המצפן חלק?".
4. 2–3 צילומי מסך, ומשפט אחד: מה אהבת ומה הפריע.

## 5. אחרי המשוב
- לתקן מה שברור. מה שתלוי בטעם, לשאול בשאלה אחת ממוקדת.
- לא לרשום בריפו מיקום אישי: שם יישוב או קואורדינטות שמופיעים בצילומי המסך.
- להריץ לפני push: `npm test`, `npm run typecheck`, `EXPO_OFFLINE=1 CI=1 npx expo lint`, ובנייה עם `EXPO_OFFLINE=1 CI=1 npx expo export --platform android`.
- לרשום שורה ב"יומן בנייה" של `ideas/2026-10-18-sunset-spots-app.md`: מה נבדק, מה עבד ומה פתוח.
