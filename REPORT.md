# BTC washout bot v4 — report

Competition: **btc-race-24h-20261118-1444** ($250, 10 places, FREE, entries
close 19 Nov 03:44 WIB). Entry: `main.ts` (Node 22) + vendored SDK
`vendor/makefun-bars.ts`. No network, no clock, no files, no randomness; all
arithmetic is BigInt, so the same bars always give the same orders.

**Status: built and verified locally. Submitted — see the claim code in the
parent agent's report.**

## Why v4 exists

v3 (commit deaa490, dev +$21.00 on the 0603 window) scores **$0.00 / 0 trades
on this race's dev window** — it FAILS this race's dev gate, so it cannot
race here at all. v3's dip is measured vs SMA-90, and in a falling window
the SMA itself falls with the price, so the dip never looks deep enough;
the SMA not-falling filters block the deeper dips outright. Raising v3's
DIP to 75 already killed its dev trades entirely (v3 REPORT.md, sweep 2).

v4 is a TRUE washout bot on a different architecture: it measures the dip
vs a **rolling high** (240 bars / 4h), a fixed anchor that does not fall
with the price. A -2.0% drawdown from the high DOES fire in a falling
knife. The reversal confirmation (this close above the previous close)
keeps it from buying mid-fall — the exact failure that lost v1's live race.

## Parameters

| parameter | value |
|---|---|
| rolling-high window | 240 bars (4h) |
| entry | close ≥ 2.0% below the rolling high + one up close |
| take-profit | **1.8% over cost** |
| stop-loss | 2.0% under cost (hard) |
| trailing stop | 1.1% from peak value |
| size | 60% of cash |
| max trades | 1 per 24h (no re-entry after exit) |
| max slippage | 100 bps (1%) |

## How the parameters were chosen

Swept on the two authoritative dev windows (1,728 combos: high_n 120–360 ×
dd 150–250 × confirm none/upbar/two_up × tp 160–240 × trail 60–150 × sl
150–250). The pick sits on a plateau, not a peak:

- trail 80/110/150 are byte-identical on both dev windows (+$21.08 total);
  trail 60 collapses to +$6.17 (exits too early). Pick 110 = middle of the
  plateau, same value v3 used.
- sl 150/200/250 are identical (SL never binds — both trades win). Pick 200.
- dd 200 / tp 180 is the best total (+$21.08); dd 220 kills the 0603 window
  (0 trades); tp 200 raises the 1444 window (+$12.11) but drops the 0603
  window to +$5.28 (total +$17.39) — TP 200 is too high for that window's
  bounce. dd 180–200 / tp 180 is a genuine plateau (+$20.49 to +$21.18).
- confirm 'upbar' beats 'none' on the 12-window total (+$16.02 vs +$4.11)
  and beats 'two_up' (which misses the 0603 trade entirely in some configs).
  One up close is the lightest confirmation that still avoids the knife.

## Backtest results

Independent backtester (own implementation of the harness fill engine —
constant-product pool, 4 bps fee, 2 bps slippage, fill at next bar's open,
flatten at last close; validated by reproducing the official grader
bit-for-bit on v1/v2/v3 and on v4's own 1444 dev grade below).

| Window | v4 PnL | v4 trades | v3 PnL | v3 trades |
|---|---|---|---|---|
| **1444 dev (this race's gate)** | **+$10.26** | 2 (1 rt, 1/1 win) | $0.00 | 0 |
| **0603 dev (previous race)** | **+$10.82** | 2 (1 rt, 1/1 win) | +$21.00 | 4 (2 rt, 2/2 win) |
| **Total, both dev windows** | **+$21.08** | | +$21.00 | |
| 12-window total (both dev + 10 Coinbase proxies) | +$16.02 | worst −$5.81 | +$15.82 | worst −$5.17 |

1444 dev detail: buys bar 241 ~$63,749 (the washout bottom) → sells bar 503
~$64,892 (the rebound high). Fees $0.48, max drawdown 0.39%, exposure 0.109
(top-10 winners: 0.02–0.11). 0603 dev detail: buys bar 564 ~$64,200 →
sells bar 960 ~$65,410. Fees $0.48, max drawdown 0.37%.

## The honest limitation (read this before judging the submit)

One trade cannot match v3's TWO winning round trips on the flat 0603
window (+$21.00 there); v4 makes +$10.82 on it. That is structural — a
1-trade, 60%-size bot cannot print +$21 on a window whose biggest single
move is ~2%. Across 1,728 swept combos, ZERO beat v3's +$21 on the 0603
window alone. v4 wins where it matters for THIS race (it passes the 1444
gate at +$10.26; v3 fails it at $0.00 and cannot race at all), is positive
on BOTH dev windows while v3 is flat on one of them, and beats v3's total
across both (+$21.08 vs +$21.00) and across all 12 windows (+$16.02 vs
+$15.82). Not submitting would leave Bos with no entry in this race at all.

## Verification

Official kit grader (`grade-local --driver process`, from the 1444 kit dir),
on the 1444 dev window — **exact match with the backtester**:

| metric | grade-local |
|---|---|
| net PnL | **+$10.26** (10,262,850 quote units) |
| trades | 2 (1 round trip) |
| fees | $0.48 |
| max drawdown | 0.39% (limit 25%) |
| win rate | 1.00 |
| exposure | 0.109 |
| l1 reproduced | true |
| dev gate (`dev_profitable`) | **PASS** (PnL > $0) |

Result sha256: `adfc7bb712914c9f8b430c21db2e1f2e9ac9f358cf0264ca99735a05b4fa4739`
Action-log sha256: `89c9bd3f10a1e4f868c32977a722aae8b83a32a0ac6243e21c524fbff3115bd4`
(One run; the backtester reproduces the same numbers, and the bot is
deterministic BigInt — the same bars always give the same orders.)

## Files

- `main.ts` — the bot (entrypoint).
- `vendor/makefun-bars.ts` — the kit SDK, vendored byte-for-byte.
- `LICENSE` — MIT, copyright 2026 a2aji.
- `README.md` — project readme.
- `REPORT.md` — this file.
- `work/` — independent backtester + v4 strategy + sweep scripts
  (`backtest.py`, `v4.py`, `strategies.py`, Coinbase/live bar data).
