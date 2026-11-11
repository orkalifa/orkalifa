# בוט מסחר ל־IBKR: פרומפטים ל־Claude Code לפי הסדר

כל פרומפט כאן מיועד להדבקה ב־Claude Code שרץ במחשב, בתיקייה `$HOME\trading-bot`.
הפרומפטים כתובים באנגלית כי זה מה שעובד הכי טוב עם קוד. ההסברים בעברית.

## לפני כל סשן עבודה

1. TWS פתוח ומחובר לחשבון **Paper**.
2. ב־PowerShell:

```bash
cd $HOME\trading-bot
```

```bash
.venv\Scripts\Activate.ps1
```

```bash
claude
```

3. מדביקים פרומפט אחד, מחכים שיסתיים, ובודקים את התוצאה. רק אז עוברים לפרומפט הבא.

> **שעות המסחר בארה"ב בשעון ישראל:** 16:30–23:00 (בחלק משבועות המעבר לשעון קיץ/חורף: 15:30–22:00).
> פרומפטים שמסומנים 🟢 צריך להריץ כשהשוק פתוח. את כל השאר אפשר להריץ בכל שעה.

---

## פרומפט 0: הכרות והגדרת הפרויקט

```
I'm building a paper-trading bot for Interactive Brokers in this folder. I am NOT a programmer:
explain briefly what you do, and ask before running anything that places orders.

Current state:
- Windows, PowerShell. Python 3.15 in a venv at .venv (already active).
- Installed: ib_async python-dotenv pandas numpy yfinance requests
- TWS is running, logged into a PAPER account, API enabled on port 7497 (localhost only).
- A quick connection test already worked.

PERMANENT RULES (write them into CLAUDE.md):
1. Paper trading only. Port 7497. Never connect to 7496 or 4001 (live ports).
2. Use ib_async, never ib_insync.
3. Every script that connects to IBKR disconnects in a finally block.
4. Use pathlib.Path, all output files inside this project folder.
5. All market times are US/Eastern via zoneinfo.ZoneInfo("America/New_York").
6. Never delete trades.csv or logs/.

TASK: create CLAUDE.md with the rules above plus a short "Project layout" section
that you will keep updated as we add files. Then run `git init` and stop.
Tell me "READY for prompt 1".
```

---

## פרומפט 1: בדיקת חיבור (קריאה בלבד)

```
Create check_connection.py:
- Connect to 127.0.0.1:7497 with clientId=99
- Print: connected (True/False), managed accounts, NetLiquidation, TotalCashValue
- Print open positions (symbol, qty, avgCost) or "no positions"
- Print open orders or "no open orders"
- Disconnect in finally
- If the connection fails, print a clear message:
  "TWS not reachable on 7497 - is TWS open and logged in to PAPER?" and exit 1
Run it and show me the output.
```

✅ **הצלחה:** מופיעים מספר החשבון שמתחיל ב־`DU`, וגם יתרת החשבון.

---

## פרומפט 2 🟢: קניית בדיקה של מניה אחת

```
Create test_buy.py that places a PAPER BUY of 1 share of MU:
- Connect 127.0.0.1:7497, clientId=10
- Safety: if managed account id does not start with "DU", abort with "NOT A PAPER ACCOUNT"
- Qualify Stock("MU", "SMART", "USD")
- Place a MarketOrder BUY 1
- Wait up to 15 seconds until status is Filled / Cancelled / Inactive (not PendingSubmit)
- Print order id, status, avg fill price; if rejected print trade.log
- Disconnect in finally
Show me the file, ask for my confirmation, then run it.
Do NOT close the position.
```

✅ **הצלחה:** ב־TWS, בחלון Portfolio, מופיעה מניה אחת של MU.

---

## פרומפט 3 🟢: סגירת פוזיציית הבדיקה

```
Create test_close.py:
- Connect 127.0.0.1:7497, clientId=11
- Find the MU position in ib.positions(). If none: print "NO POSITION TO CLOSE", exit 0
- Place a MarketOrder SELL for the full quantity
- Wait up to 15 seconds for a final status, print qty, fill price, status
- Disconnect in finally
Ask for my confirmation, then run it.
```

✅ **הצלחה:** הפוזיציה של MU נעלמת מ־TWS. מכאן ידוע שכל השרשרת עובדת: Claude ← Python ← IBKR.

---

## פרומפט 4: קובץ האסטרטגיה

האסטרטגיה הבאה היא "Trend Join Long" מהמדריך. זו נקודת התחלה, ומשנים אותה דרך הקובץ הזה בלבד, בלי לגעת בקוד.

```
Create rules.json with EXACTLY this content, then print it back. Do not run anything.

{
  "strategy_name": "Trend Join Long",
  "direction": "long_only",
  "trade_timeframe": "5m",
  "universe": { "index": "S&P 500", "min_price_usd": 3.0 },
  "daily_filters": {
    "D1_above_prior_day_high": true,
    "D2_prior_close_above_sma200": true,
    "D3_min_gap_pct_from_prior_close": 3.0
  },
  "intraday_filters": {
    "I1_above_premarket_high": true,
    "I2_above_today_hod": true,
    "I3_rvol_min": 2.0,
    "I3_rvol_lookback_days": 14
  },
  "time_filter": {
    "earliest_entry_et": "10:05",
    "latest_entry_et": "15:30",
    "force_close_et": "15:51"
  },
  "exit": {
    "initial_stop_rule": "lod_minus_1pct",
    "partial_profit_trigger_R": 0.75,
    "partial_profit_fraction": 0.3333,
    "breakeven_trigger_R": 1.0,
    "post_breakeven_trail": "swing_low_5m"
  },
  "risk": {
    "max_risk_per_trade_pct": 1.0,
    "max_position_size_pct_of_portfolio": 10,
    "max_concurrent_positions": 5,
    "max_trades_per_day": 5,
    "max_daily_loss_pct": 2.0
  }
}
```

---

## פרומפט 5: קבצי הגדרות

```
Create these 3 files (do not overwrite if they exist - stop and ask):

1. .env
IBKR_HOST=127.0.0.1
IBKR_PORT=7497
IBKR_CLIENT_ID=2
IBKR_EXEC_CLIENT_ID=3
PAPER_TRADING=true
PORTFOLIO_VALUE_USD=25000

2. .gitignore
.env
.venv/
__pycache__/
*.pyc
logs/
dashboard/
watchlist.txt
STOP

3. requirements.txt
ib_async
python-dotenv
pandas
numpy
yfinance
requests
lxml

Then run: python -m pip install -r requirements.txt
Update CLAUDE.md project layout. Print the file tree.
```

> `PORTFOLIO_VALUE_USD=25000`: הבוט יחשב גודל פוזיציות כאילו יש בחשבון 25,000 דולר ולא מיליון, כדי שהתוצאות יהיו קרובות למה שיקרה עם כסף אמיתי.

---

## פרומפט 6: ליבת הבוט (חיבור, הגדרות, יומן עסקאות)

```
Create the core package. Do NOT place any orders in this step.

src/__init__.py  (empty)

src/config.py
- load .env with python-dotenv, load rules.json
- expose a Config object (host, port, client ids, portfolio value, rules dict)
- SAFETY GUARD on load: if PAPER_TRADING=true and port in {7496, 4001} -> sys.exit("ABORT: live port with paper flag").
  Also abort if PAPER_TRADING is not "true" (this project is paper only).

src/ibkr_client.py  - class IBKRClient(client_id)
- connect(); after connecting, abort if the account id does not start with "DU"
- qualify(symbol) -> Stock contract
- daily_bars(symbol, days) and intraday_bars(symbol, "5 mins", include premarket) via reqHistoricalData
- place_bracket_entry(symbol, qty, stop_price) -> parent BUY MarketOrder + child STOP SELL order
  (the stop lives on the IBKR server, so it protects the position even if the bot crashes)
- modify_stop(symbol, new_stop), sell_partial(symbol, qty), close_position(symbol) (also cancels its stop)
- positions(), open_orders(), disconnect()
- wait for order status to settle (max 15s) after every order

src/journal.py
- logs/trades.csv with columns:
  trade_id, symbol, entry_time_et, entry_price, qty, initial_stop, risk_per_share,
  exit_time_et, exit_price, exit_reason, partial_taken, pnl_usd, r_multiple, status
- functions: open_trade(...), update_trade(...), close_trade(...), todays_trades(), todays_pnl()
- logs/bot.log: every line prefixed with [YYYY-MM-DD HH:MM:SS ET]

Write a quick test: python -m src.ibkr_client --selftest that connects, prints account id and
AAPL last 5 daily bars, and disconnects. Run the selftest and show me the output.
Update CLAUDE.md.
```

---

## פרומפט 7: רשימת מניות S&P 500

```
Create update_universe.py:
- Download the current S&P 500 constituents from the Wikipedia page
  "List of S&P 500 companies" using pandas.read_html (needs lxml)
- Save to data/sp500.csv with columns: symbol_ibkr, symbol_yahoo, name, sector
  (IBKR uses a space for share classes: "BRK B"; Yahoo uses a dash: "BRK-B")
- Print the count (expect ~500-505) and first/last 5
- If the download fails, keep the old file and exit 1
Run it once.
Add a note in CLAUDE.md: re-run update_universe.py once a month.
```

---

## פרומפט 8: סורק הבוקר (Gappers)

```
Create prefilter.py (scanning uses yfinance, NOT IBKR - IBKR paper limits market data requests):
- Read data/sp500.csv
- yf.download all yahoo symbols, period="5d", interval="1d", group_by="ticker", threads=5, auto_adjust=True
- For each ticker: prev_close = last completed day close; current = latest price
  gap_pct = (current - prev_close) / prev_close * 100
- Keep: current >= rules.universe.min_price_usd AND gap_pct >= rules.daily_filters.D3_min_gap_pct_from_prior_close
- Sort by gap desc, keep top 20, write watchlist.txt (header comments with timestamp ET, filters, count;
  then one line per ticker: "SYMBOL  # gap +X.XX%  price $X.XX  prev $X.XX")
- --dry-run flag: print only, do not write
- Print a JSON summary: screened, survivors, failed, elapsed_seconds, top list
- If more than 30% of tickers fail, print "ALERT: yfinance degradation" to stderr
Run it with --dry-run and show me the output.
```

---

## פרומפט 9: מנוע האסטרטגיה (6 המסננים)

```
Create strategy.py with evaluate(symbol, client, rules) -> dict:
{ "symbol", "pass": bool, "price", "stop", "checks": {name: {"ok": bool, "value": ...}}, "reason" }

Checks, in order (stop at the first failure, but record what was computed):
- already_in_position / max_concurrent_positions / max_trades_per_day / max_daily_loss (from journal)
- time window: earliest_entry_et <= now ET <= latest_entry_et
- D1: current price > prior day high
- D2: prior day close > SMA200 of daily closes (need 210 daily bars)
- D3: gap from prior close >= min gap
- I1: current price > today's premarket high (04:00-09:30 ET, 5m bars with useRTH=False)
- I2: current price >= today's regular-session high so far (breaking to new highs)
- I3: relative volume >= rvol_min: today's volume so far vs the average volume of the same
      time window over the last rvol_lookback_days days
- stop = today's low * (1 - 0.01). Reject if stop >= price.

Cast all numpy values to plain bool/float before returning.
Append every evaluation to logs/evaluations.jsonl.

Create evaluate_one.py --symbol XYZ that prints the result as a readable table.
Run it on NVDA and show me (outside market hours the time check will fail - that's expected,
but show the other computed values anyway).
```

---

## פרומפט 10: מחזור המסחר (כניסות, יציאות וניהול סיכון)

```
Create cycle.py - one full trading cycle. Flags: --dry-run (evaluate and log, never place orders), --loop.

Each cycle:
0. If a file named STOP exists in the project folder -> log "kill switch active", do nothing, exit.
1. Load config + rules, connect with IBKR_CLIENT_ID.
2. MANAGE OPEN POSITIONS first (for every open trade in the journal):
   - R = (price - entry) / risk_per_share
   - if R >= partial_profit_trigger_R and partial not taken -> sell partial_profit_fraction of qty, mark partial_taken
   - if R >= breakeven_trigger_R -> move the server-side stop to entry price
   - after breakeven: trail the stop to the most recent 5m swing low (low lower than 2 bars on each side), only upward
   - if position was stopped out by IBKR (no longer in positions) -> close the trade in the journal with exit_reason "stop"
   - at or after force_close_et -> close everything, exit_reason "eod"
3. NEW ENTRIES (only inside the entry window):
   - read watchlist.txt, evaluate each symbol with strategy.evaluate
   - for each pass: qty = floor(min(risk_budget / (price - stop), position_cap / price))
       risk_budget = PORTFOLIO_VALUE_USD * max_risk_per_trade_pct / 100
       position_cap = PORTFOLIO_VALUE_USD * max_position_size_pct_of_portfolio / 100
   - qty < 1 -> skip. Otherwise place_bracket_entry and journal.open_trade
4. Log a one-line summary: open positions, entries, exits, today's P&L.
5. Disconnect in finally.

--loop: run a cycle every 5 minutes from 09:35 to 16:00 ET, run prefilter.py every 30 minutes
between 09:30 and 11:00 ET, then exit after the force close.

Create run_day.ps1 that activates .venv and runs: python cycle.py --loop

Run python cycle.py --dry-run once and show me the log output.
```

**איך עוצרים את הבוט בכל רגע:** יוצרים קובץ ריק בשם `STOP` בתיקייה של הבוט. כדי להפעיל אותו שוב, מוחקים את הקובץ.

---

## פרומפט 11: דשבורד ביצועים

```
Create compute_perf.py:
- Read logs/trades.csv (closed trades only)
- Compute: total trades, win rate, average R, total R, profit factor, total P&L USD,
  max drawdown (in R), best/worst trade, average holding time, today's P&L
- Print the summary as JSON
- Generate dashboard/index.html (single self-contained file, no external CDN):
  * KPI cards on top (win rate, avg R, total P&L, profit factor, max drawdown)
  * Equity curve in R (cumulative R per trade) - inline SVG
  * R-multiple histogram - inline SVG
  * Table of all trades (newest first), green/red rows
  * Open positions section from logs/trades.csv where status=open
  * Dark theme, readable on a laptop, auto-refresh every 60 seconds (meta refresh)
- If there are no trades yet, show an empty state "No closed trades yet"
Run it and open the dashboard in the browser (start dashboard\index.html).
Add `python compute_perf.py` at the end of cycle.py's --loop (after the force close).
```

---

## פרומפט 12: בדיקה כללית לפני יום מסחר אמיתי

```
Do a full pre-flight review of the project, without placing orders:
1. Read every .py file and list any bug, missing error handling, or place where an order
   could be sent without a stop.
2. Confirm the live-port guard and the "DU" account guard work (simulate by temporarily
   passing port 7496 to Config in a test - do NOT actually connect).
3. Run: check_connection.py, prefilter.py --dry-run, cycle.py --dry-run, compute_perf.py
4. Give me a short checklist of what to do tomorrow at market open.
Fix only clear bugs and tell me what you changed.
```

---

## יום מסחר (אחרי שהכול עובד)

1. **16:00 שעון ישראל:** פותחים את TWS ומתחברים לחשבון ה־Paper.
2. **לפני 16:35:** לוחצים לחיצה כפולה על `run_day.ps1`, או מריצים ב־PowerShell:

```bash
cd $HOME\trading-bot
```

```bash
.venv\Scripts\Activate.ps1
```

```bash
python cycle.py --loop
```

3. **במהלך היום:** לא נוגעים בבוט. בודקים את `dashboard\index.html` מדי פעם.
4. **בסוף היום:** הבוט סוגר את כל הפוזיציות לבד, ב־22:51 שעון ישראל.

> **חשוב:** לפחות שבועיים של Paper בלבד לפני שחושבים על כסף אמיתי. בודקים ב־`logs/evaluations.jsonl` אם הבוט מוותר על עסקאות טובות או נכנס לעסקאות רעות, ומשנים רק את `rules.json`.

## שלבים להמשך (לא בסבב הראשון)

- **התראות Telegram:** הודעה לטלפון על כל כניסה ויציאה, וסיכום יומי.
- **Task Scheduler:** הפעלה אוטומטית בכל יום מסחר, במקום להריץ את `run_day.ps1` ידנית.
