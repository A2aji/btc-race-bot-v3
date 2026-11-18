# BTC swing bot v3 — report

Competition: **btc-race-24h** (next race after 20261117-0603) — "Race a BTC trading bot
live for 24 hours" (harness bars-replay/v1, cbBTC on Orca Whirlpool, $1,000 paper
USDC, 1-min bars). Entry: `main.ts` (Node 22) + vendored SDK
`vendor/makefun-bars.ts`. No network, no clock, no files, no randomness; all
arithmetic is BigInt, so the same bars always give the same orders.

**Status: built and verified locally. NOT submitted — no new race is open yet.
Ready to submit as soon as the next BTC race opens.**

## What changed vs v2 (exactly one parameter)

| parameter | v2 | v3 |
|---|---|---|
| dip below SMA-90 | 0.70% | 0.70% (unchanged) |
| confirmation | two consecutive up closes | unchanged |
| take-profit | **1.6%** | **1.8%** |
| stop-loss | −2.0% | unchanged |
| trailing stop | 1.1% from peak | unchanged |
| size | 60% of cash | unchanged |
| SMA-90 / SMA-200 not-falling filters | yes | unchanged |

`main.ts` differs from v2's only in its header comment and `TP_BPS` (160n → 180n).
`vendor/makefun-bars.ts` is byte-for-byte identical to v2's
(sha256 `9677370b0ab7e759c486a929afc95a11fb0fb32c7ec37053d3ebabd426aec5c8`).

## Why: the top-10 lesson, tested instead of assumed

The top-10 analysis (`~/workspace/research_notes/btc-race-01/top10-analysis.md`)
found the live winners buy a **deep washout** (~4.5% down) and **hold to a
+2.0–2.5% rebound**, 1–2 trades, exposure ≤ 0.15 — while v2 buys a shallow
0.70% dip and takes profit at +1.6%. The prescription was: raise DIP to
1.5–3.0% and TP to 2.0–2.5%. We swept it on the **same 11 windows** as v2
(kit dev window + 10 Coinbase BTC-USD 1-min windows + the live-race partial
window), holding SL 200 / trailing 110 / size 6000 / SMA-200 rising /
two-up confirmation fixed. Independent backtester (`work/backtest.py` +
`work/strategies.py::make_new4`), which reproduces the kit grader bit-for-bit
on v1 (+$25.50 dev) and v2 (+$17.93 dev).

### Sweep 1 — the specified grid: DIP × TP

| DIP \ TP | 160 | 200 | 250 |
|---|---|---|---|
| **70** | **+$12.75** (dev +$17.93, worst −$5.17, maxDD 0.83%, 6 trades) | +$9.61 (dev +$14.79) | +$2.54 (dev +$7.72, maxDD 1.01%) |
| **100** | −$5.17 (dev $0.00, only W8 trades) | −$5.17 (dev $0.00) | −$5.17 (dev $0.00) |
| **125** | $0.00 (0 trades, all windows) | $0.00 | $0.00 |
| **150** | $0.00 (0 trades) | $0.00 | $0.00 |
| **175** | $0.00 (0 trades) | $0.00 | $0.00 |
| **200** | $0.00 (0 trades) | $0.00 | $0.00 |

**Within the specified grid, NO combination beats v2.** The aggressive
prescription fails on both halves:

- **Deep DIP kills the bot.** DIP 75 (fine scan below) already kills the dev
  trades entirely — the cliff v2's report warned about ("dip 75 kills the
  dev trades entirely") is real and was reproduced exactly. DIP 100 keeps
  only the single losing W8 trade (total −$5.17, dev $0.00 → **fails the dev
  gate**). DIP ≥ 125 never trades anywhere in 11 windows. A washout bot
  cannot pass the dev gate on this data, because the dev window's two
  buyable dips are only ~0.7–1.0% deep vs the SMA-90 — a 1.5%+ threshold
  never fires there, and the SMA-200 / SMA-90 not-falling filters block the
  deeper dips in the crash windows anyway.
- **TP 200/250 hurts.** At DIP 70, raising TP 160 → 200 → 250 drops the
  total +$12.75 → +$9.61 → +$2.54 and pushes max DD to 1.01% at TP 250.
  The second dev trade misses TP 200, rides up, then gets banked by the
  1.1% trailing stop for only +$3.62 (vs +$10.90 at TP 190).

### Sweep 2 — fine DIP scan (TP 200)

| DIP | 70 | 75 | 80 | 85 | 90 | 100 | 110 | 125 |
|---|---|---|---|---|---|---|---|---|
| total | +$9.61 | −$5.17 | −$5.17 | −$5.17 | −$5.17 | −$5.17 | −$5.17 | $0.00 |
| dev | +$14.79 | $0.00 | $0.00 | $0.00 | $0.00 | $0.00 | $0.00 | $0.00 |

The cliff is exactly between DIP 70 and 75: one 5 bps step takes dev from
+$14.79 to $0.00. The W8 trade survives up to DIP 110 (its dip is deeper),
then dies too at 125.

### Sweep 3 — fine TP scan (DIP 70), the plateau v3 is picked from

| TP | 160 (v2) | 165 | 170 | 175 | 180 (v3) | 185 | 190 | 195 | 200 |
|---|---|---|---|---|---|---|---|---|---|
| total | +$12.75 | +$14.22 | +$14.82 | +$14.82 | **+$15.82** | +$16.89 | +$16.89 | +$9.61 | +$9.61 |
| worst | −$5.17 | −$5.17 | −$5.17 | −$5.17 | −$5.17 | −$5.17 | −$5.17 | −$5.17 | −$5.17 |
| max DD | 0.83% | 0.83% | 0.83% | 0.83% | 0.83% | 0.83% | 0.83% | 0.83% | 0.83% |
| trades | 6 | 6 | 6 | 6 | 6 | 6 | 6 | 6 | 6 |
| dev | +$17.93 | +$19.39 | +$19.99 | +$19.99 | **+$21.00** | +$22.06 | +$22.06 | +$14.79 | +$14.79 |

TP 165–190 is a genuine plateau: every point beats v2, worst window,
max DD and trade count are identical throughout. **TP 180 is picked as the
middle of the plateau** (165–190, midpoint ~177.5); it also reproduces the
+$15.82 total v2's own report already measured at TP 180, so this is a
reproduction, not a new discovery. The cliff is 5 bps above the plateau top
(TP 195 → +$9.61); TP 180 sits 15 bps from it. For scale, v2's own DIP 70
sits only 5 bps from its cliff at DIP 75, so v3's TP choice is *less*
cliff-adjacent than v2's entry threshold.

DIP plateau at TP 180: DIP 65 and 70 give identical +$15.82 (same trades);
DIP 60 collapses to −$0.29 (worst −$13.15, maxDD 1.31% — an extra bad trade);
DIP 75 kills dev ($0.00). DIP stays 70.

### Selection against the four criteria

| criterion | v2 | v3 (DIP 70 / TP 180) | verdict |
|---|---|---|---|
| (a) total PnL up from +$12.75 | +$12.75 | **+$15.82 (+$3.07, +24%)** | PASS |
| (b) worst no worse than −$5.17 | −$5.17 | **−$5.17 (identical)** | PASS |
| (c) max DD < 1% in all windows | 0.83% | **0.83%** | PASS |
| (d) dev PnL > $0 (dev gate) | +$17.93 | **+$21.00** | PASS |

All four pass. No specified-grid combination passes all four; the
qualifying combination comes from the fine TP scan (TP 180), which the
task's plateau rule explicitly invites ("pilih plateau").

## Multi-window backtest (11 x 24h windows) — v3 vs v2

| Window | Dates (06:00 UTC) | Trend | v3 PnL | v3 trades | v2 PnL |
|---|---|---|---|---|---|
| W0 — dev (kit cbBTC) | 16–17 Nov | +0.49% | **+$21.00** | 4 (2 rt, 2/2 win) | +$17.93 |
| W1 — down, mild | 8–9 Nov | −1.76% | $0.00 | 0 | $0.00 |
| W2 — crash | 12–13 Nov | −7.44% | $0.00 | 0 | $0.00 |
| W3 — down, high vol | 14–15 Nov | −4.08% | $0.00 | 0 | $0.00 |
| W4 — sideways | 9–10 Nov | +0.45% | $0.00 | 0 | $0.00 |
| W5 — flat | 7–8 Nov | −0.27% | $0.00 | 0 | $0.00 |
| W6 — down, mild | 10–11 Nov | −1.13% | $0.00 | 0 | $0.00 |
| W7 — down, mild | 11–12 Nov | −0.47% | $0.00 | 0 | $0.00 |
| W8 — rise then fall | 13–14 Nov | −1.08% | **−$5.17** | 2 (1 rt, 0/1 win) | −$5.17 |
| W9 — flat | 15–16 Nov | +0.13% | $0.00 | 0 | $0.00 |
| W10 — live race (partial) | 17–18 Nov | −0.43%\* | $0.00 | 0 | $0.00 |
| **Total / mean / worst** | | | **+$15.82 / +$1.44 / −$5.17** | **6** | **+$12.75 / +$1.16 / −$5.17** |

\* W10 trend is over the partial window only (race still running at test time).

Dev detail (v3): buys bar 372 ~$64,063 → sells bar 512 ~$65,195 (+$10.11);
buys bar 572 ~$64,203 → sells bar 960 ~$65,409 (+$10.89). Fees $0.97,
max drawdown 0.40%. v2 sold the same two entries earlier (bars 510/936,
+$8.66/+$9.27). W8 detail (unchanged from v2): buys bar 1233 ~$67,369 →
sells bar 1291 ~$66,842 (−$5.17); TP never binds there — the loss is set by
the trailing stop / stop-loss, so TP 160 vs 180 makes no difference.

## Parameters (v3)

| parameter | value |
|---|---|
| slow average | 90 bars |
| long average | 200 bars |
| dip below slow average | 0.70% |
| confirmation | two consecutive up closes |
| take-profit | **1.8% over cost** |
| stop-loss | 2.0% under cost |
| trailing stop | 1.1% from peak value |
| size | 60% of cash |
| regime (both averages not falling) | within 0.1% |
| max slippage | 100 bps (1%) |

## Honest limitations

- **The gain is small and entirely dev-window timing.** +$3.07 comes from
  the same two dev round-trips held a few bars longer (sell bars 512 vs 510
  and 960 vs 936). 9 of 11 windows are identical to v2. On a new live
  window, TP 180 vs 160 is close to a coin flip on whether the bounce
  extends ~20 bps further — the trailing stop does most of the work either
  way.
- **v3 is still NOT a washout bot.** It cannot buy a 1.5%+ dip anywhere in
  the test data, so in a true washout race it would still sit out the move
  the top 10 rode to $14–$31 in one window. The deep-dip lesson could not
  be implemented without failing the dev gate; the dev window simply has no
  deep dip to buy. v3 banks slightly more on a dev-type bounce while
  keeping v2's downside bound — it does not chase the top-10 payoff.
- **The TP plateau has a cliff 15 bps above the pick** (TP 195 → total
  +$9.61). TP 180 is mid-plateau, but a live bounce that peaks just short
  of +1.8% and retraces would be banked by the trailing stop at roughly the
  TP-200 outcome (+$3.62 on that leg in dev) instead of the TP-180 outcome.
- **v3 is selective to a fault, like v2: it trades in only 2 of 11 windows.**
  In the other 9 it scores exactly $0.00 — in a quiet or falling race window
  it would fail the ≥1-trade guardrail and rank below every entry that meets
  it. That is the price of refusing negative-EV trades; every attempt to
  force participation (v2's work) lost money.
- **The edge rests on few trades:** the +$15.82 total comes from 3
  round-trips (2 dev wins, 1 W8 loss). A new race window is a new regime —
  the multi-window result bounds the downside (worst −$5.17 in 11 windows,
  max drawdown 0.83%) rather than promising a win.
- **W1–W9/W10 are Coinbase BTC-USD proxies, not cbBTC pool bars.** Only W0
  is authoritative for grading — and there the official grader and the
  independent backtester agree to the cent (below).

## Verification

Official kit grader (`grade-local --driver process`, from the kit dir), 3 runs,
all identical — deterministic:

| metric | run 1 | run 2 | run 3 |
|---|---|---|---|
| net PnL | +$21.00 | +$21.00 | +$21.00 |
| trades | 4 | 4 | 4 |
| fees | $0.97 | $0.97 | $0.97 |
| max drawdown | 0.40% (limit 25%) | 0.40% | 0.40% |
| Sharpe | 0.053 | 0.053 | 0.053 |
| exposure (dev) | 0.221 | 0.221 | 0.221 |
| win rate | 1.00 | 1.00 | 1.00 |
| l1 reproduced | true | true | true |
| dev gate (`dev_profitable`) | **PASS** (PnL > $0) | PASS | PASS |

Result sha256: `363b63491100d1574e982186b0385e96bee7d73bbe679eb09d22bc2217ee7eec`
Action-log sha256: `531ff6348060bc409b230565771206d8ea8cde0d29e7257e48cf4147546e9573`
(identical across all 3 runs).

Independent backtester (own implementation of the harness fill engine —
constant-product pool, 4 bps fee, 2 bps slippage, fill at next bar's open,
flatten at last close; validated by reproducing v1's official dev grade
bit-for-bit: +$25.50, 4 trades, 1.32% DD, $1.62 fees): v3 dev **+$21.00,
4 trades, 0.40% DD, $0.97 fees — exact match with grade-local.**

## Files

- `main.ts` — the bot (entrypoint).
- `vendor/makefun-bars.ts` — the kit SDK, vendored byte-for-byte
  (sha256 `9677370b0ab7e759c486a929afc95a11fb0fb32c7ec37053d3ebabd426aec5c8`).
- `LICENSE` — MIT, copyright 2026 a2aji.
- `README.md` — project readme.
- `REPORT.md` — this file.
- `work/` — independent backtester + sweep scripts (`sweep_v3.py`,
  `sweep_v3_out.txt`), copied from v2's work dir, v2 files untouched.
