# Paper Trading (manual + bot) — Design

Date: 2026-10-20
Status: approved 2026-10-20 (market-hours-only trading kept as the default); implemented on feat/paper-trading

## Intent

Give STONKS a paper trading account: virtual cash, live NSE prices, no real
money. The user wants to buy and sell a few stocks themselves **and** have a
bot trade alongside them using STONKS's own signals, to see how both do.

It also replaces the current trade tracker, which the user describes as
"very buggy". A code read (2026-10-20) found the bugs are structural:

1. Prices and stop/target exits only update while a browser tab is open, so
   a stock can blow through its stop unnoticed.
2. Trades live in localStorage and the whole list is pushed to the server
   600ms later, with active and completed trades written as two separate
   lists. Interrupted writes or a stale device can lose or duplicate trades;
   login overwrites local data with the server copy unconditionally.
3. Exit labels are wrong (a profitable manual close from `ActiveTradePanel`
   is recorded as "Target reached").
4. The rules exist twice (TS `trade_storage_service.ts`, Python
   `analysis/trade_management.py`) and disagree: different status names, the
   Python P&L ignores quantity, and its summary only counts statuses the
   frontend never produces.
5. "SELL trackers" are a bolted-on variant with inconsistent P&L.

So the core decision: **the backend owns the paper account.** One set of
rules, one store, all fills and exits computed server-side.

## Goals

- One paper account per logged-in user: starting cash, cash balance,
  holdings, realized and unrealized P&L, full trade history.
- Manual market orders: buy or sell any NSE stock by quantity at the live
  price, with an optional target and stop-loss on buys.
- Automatic exits: a position with a target or stop is sold when the live
  price reaches it.
- A bot the user can switch on and off that watches a list of stocks, buys
  when the signal engine says `BUY NOW`, and exits at the engine's target or
  stop-loss.
- Clear attribution: every position and trade is tagged **You** or **Bot**,
  and the summary shows P&L for each.
- The Portfolio page becomes the paper trading page.

## Non-goals

- Real brokers or real money, ever.
- Short selling, options, futures, leverage, margin.
- Limit/stop orders sitting in a book (only market orders + target/stop
  exits on held positions).
- Brokerage fees, taxes, slippage modelling.
- Trailing stops (the old tracker had them; not carried over in v1).
- Running 24/7. The backend is on Render's free tier and sleeps after ~15
  minutes idle. The user said it's fine for the bot to trade only while the
  app is in use. No keep-alive pinging.
- Migrating old tracked trades (they're unreliable; the old localStorage keys
  are simply no longer read).

## Anti-goals (would make this a failure even if it "works")

- Trades or cash appearing, disappearing or double-counting. Every change to
  an account must be atomic: cash, positions and history move together or
  not at all.
- The bot selling shares the user bought, or the user's sell touching the
  bot's shares.
- A second copy of the trading rules on the frontend. The frontend displays
  and submits; it never computes fills, P&L of record, or exits.
- Silently filling at a price far from the trigger without saying so.

## Decisions

Decided by the user:
- Both manual trading and a bot.
- Bot behaviour: watch a list, buy on the engine's BUY, exit at the engine's
  target/stop.
- Bot only needs to run while the app/server is up; no keep-awake.
- Backend-owned account replacing the buggy tracker (proposed, accepted).

Claude's calls (user can override while reading):
- **Starting cash ₹10,00,000.** A "Reset account" button wipes positions and
  history, restores starting cash, and turns the bot off (with a confirm).
- **Market hours only.** Orders and the bot run only during NSE hours
  (Mon–Fri 09:15–15:30 IST), using the existing market-open logic
  (`analysis/cache.py` `is_market_open` / the quote's `is_market_open`).
  Outside hours, the order form says the market is closed. No holiday
  calendar in v1; on a holiday the quote is stale and the order is rejected
  if the quote reports market closed.
- **Fill price = live quote** from `fetch_live_quote` in
  `api/routers/analysis.py`. Whole shares only, quantity ≥ 1.
- **Positions are kept separately for You and Bot** (keyed by ticker +
  owner), each with its own average cost. Cash is shared. A sell only draws
  from that owner's position. A buy into an existing same-owner position
  averages the cost; target/stop on that position are replaced by the new
  order's values if given, else kept.
- **Selling** can be partial. Sell quantity can't exceed the owner's held
  quantity. Buys can't exceed cash.
- **Auto-exit** sells the whole position at the current quote when
  price ≥ target or price ≤ stop. If the fill is more than 1% past the
  trigger (e.g. server was asleep, price gapped), the history entry says so:
  "Stop ₹X, filled at ₹Y (price moved past stop while app was closed)".
- **Exit reasons** recorded on every sell: `MANUAL`, `TARGET` or `STOP`.
  (Reset is not a sell; it just wipes the account.)
- **User can edit or clear target/stop** on their own positions. Bot
  positions' target/stop are the bot's and aren't editable (user can still
  close a bot position manually — recorded as a manual sell of a Bot
  position).
- **Bot settings:** on/off; stock list (max 15, default: the 10 large caps
  at the top of `load_symbols_catalog()` — RELIANCE, TCS, HDFCBANK, …);
  budget per trade (default ₹1,00,000; buys `floor(budget / price)` shares,
  skips if that's 0 or cash is short); max open bot positions (default 5).
  One bot position per ticker at a time.
- **Bot cadence:** a single backend background thread wakes every 60s.
  Each tick during market hours: (a) check target/stop on every open
  position for every account (cheap, quote-only); (b) every 5 minutes,
  for each account with the bot on, evaluate its stock list.
  Signal = `trade_signal` from `_run_deterministic_pipeline(...,
  interval="1d", skip_intelligence=True)` — the same 1D signal the
  dashboard shows. `signal_type == "BUY_NOW"` with a non-null target and
  stop → buy. Exits are handled by (a), not by the bot re-reading signals.
- **Catch-up on read:** whenever an account is loaded via the API, its
  target/stop checks run first (if the market is open), so a server that
  just woke up corrects state before showing it.
- **Bot activity log:** last ~50 bot decisions (bought X, skipped Y — no
  cash / max positions / signal WAIT, errors) shown in the bot panel.
- **Storage:** the whole account is one JSON document per user, stored via
  `api/user_data_store.py` under key `paper_account` (works with both the
  Postgres and JSON-file backends that already exist). Every mutation is
  load → modify → save under a per-user `threading.Lock`, which makes it
  atomic in Render's single uvicorn process. History is capped (keep last
  1,000 trades) so the document stays small.
- **Account index for the background thread:** the store keeps a separate
  small key/registry of usernames that have a paper account, so the thread
  doesn't need to scan all users.
- **Old tracker removed:** `frontend/src/services/trade_storage_service.ts`,
  `ActiveTradePanel.tsx`, `TradePerformanceDashboard.tsx`, the trade
  update loop in `watchlist_monitor_service.ts`, the trade sync call in
  `AuthContext.tsx`, `analysis/trade_management.py` and its test
  `tests/test_trade_performance.py`, and the `TrackedTrade` types. The
  `analysis/models/trade_performance.py` models go too if nothing else uses
  them.

## Shape of the build

### Backend

- `analysis/paper_trading.py` — pure logic, no I/O: account dataclass/dict
  shape, `buy`, `sell`, `check_exits(account, quotes, now)`,
  `bot_decide(account, ticker, signal, quote)`, `summary(account, quotes)`.
  Raises a clear error type on invalid orders (insufficient cash, qty >
  held, market closed). This is where nearly all the tests go.
- `api/paper_store.py` — load/save account via `user_data_store`, per-user
  locks, account registry, `with_account(username, fn)` helper that does
  locked read-modify-write.
- `api/paper_bot.py` — the background thread (started on app startup, not
  in tests unless explicitly enabled — mirror how the top-opportunities scan
  thread is kept out of tests), tick logic, quote/signal fetching through
  existing deps.
- `api/routers/paper.py`, prefix `/paper`, auth via the existing bearer
  token (same pattern as `api/routers/user_data.py`):
  - `GET /paper/account` — cash, equity, P&L (total, You, Bot), positions
    with live price & unrealized P&L, market-open flag. Runs catch-up exits
    first.
  - `POST /paper/orders` — `{ticker, side: BUY|SELL, quantity, owner?
    (SELL only: YOU|BOT, default YOU), target?, stop?}` → the fill.
  - `PATCH /paper/positions/{owner}/{ticker}` — edit target/stop (YOU only).
  - `GET /paper/history?limit=` — trades newest first.
  - `GET /paper/bot`, `PUT /paper/bot` — settings + activity log.
  - `POST /paper/reset`.
  - Errors as 400 with a human message (`"Not enough cash: need ₹52,300,
    have ₹41,000"`).

### Frontend

- `/portfolio` route keeps its URL; sidebar label becomes "Paper Trading".
  The page shows: account header (cash, invested, equity, total P&L, You vs
  Bot P&L, market open/closed), order ticket (stock search reusing the
  existing search component, Buy/Sell, quantity with cost preview, optional
  target/stop), holdings table (owner tag, qty, avg cost, live price, P&L,
  target/stop, Sell button), bot panel (switch, stock list editor, budget,
  max positions, last run, activity log), trade history (owner, side, qty,
  price, P&L, reason, time), CSV export, Reset.
- Polls `GET /paper/account` every ~15s while the page is open.
- Dashboard: `TradeSignalPanel`'s "track trade" buttons become a
  "Paper buy" button that opens the order ticket prefilled with the
  signal's target/stop; `ActiveTradePanel` is replaced by a small "Your
  paper position in X" line if one exists.
- `services/paper_trading_service.ts` — thin typed API client. No trading
  math on the frontend beyond the cost preview (qty × displayed price).

### Testing

- Unit tests for `analysis/paper_trading.py`: buy/sell cash & avg cost,
  partial sell, rejections, You/Bot isolation, target and stop exits,
  gap-fill note, bot buy/skip reasons, summary maths.
- API tests for `/paper/*` with quotes and pipeline monkeypatched (no
  network), including market-closed rejection and reset.
- Bot tick test with a fake clock and fake signals; the real thread must not
  start during the test suite.
- Frontend: vitest for the API client/formatting where there's logic;
  `npm run lint`, `npm run build`.
- Existing invariants in project memory still hold (trade-signal
  validation, backtest execution, auth on every route).

## Left to the builder

- Exact JSON field names, React component split, styling (match the existing
  dark slate/emerald look of the Portfolio page).
- Whether the activity log and history live in the same document (yes is
  fine) and exact caps.
- How the bot thread reaches the shared downloader/cache/live-cache
  singletons (`api/deps.py`).
- Whether a desktop notification fires when the bot trades (nice-to-have via
  the existing `notificationService` when the polled history shows a new bot
  trade).

## Revision 2026-10-21: bot exits and signal timing

A replay of the bot over Jan–Oct 2026 (15 large caps, signals recomputed on
data up to each prior close) found the engine's fixed levels (stop −0.76%,
target +2.2%) were stopped out by ordinary daily noise: 30 trades, 8 won,
−₹10,153. Two changes, bot only (the dashboard signal is unchanged):

- **Signal from yesterday's close.** The bot's signal is computed on completed
  daily bars only (`_run_deterministic_pipeline(..., as_of_previous_close=True)`),
  cached once per stock per day, so it can't flip back and forth on a
  half-formed bar.
- **ATR-based exits.** Stop = fill − 2×ATR14, target = fill + 1.5×(2×ATR14)
  (`pt.bot_levels`). Same replay: 16 trades, 7 won, +₹4,720; positive in two of
  the three 3-month windows. Looser entries (strong ACCUMULATE) and a max-hold
  exit were also tested and lost money in every combination, so neither was
  adopted. The sample is small; treat the bot as an experiment.
