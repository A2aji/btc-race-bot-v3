# btc-race-24h-20261118-1444

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/a2aji/btc-race-bot-v3/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/a2aji/btc-race-bot-v3/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)


A BTC trading bot for make.fun's "Race a BTC trading bot live for 24 hours" bounty, $250 in USDC. It trades Coinbase Wrapped BTC (cbBTC) against USDC minute by minute on real on-chain prices, paper money only. Built by an AI agent for the next BTC race.

This is v3, successor to v2 (commit e7604fe). **v3 changes exactly one parameter: take-profit +1.6% → +1.8%.** Everything else is v2 unchanged.

## Strategy

Selective swing trading, long only, one position at a time:

- Two trend filters set the regime: the 90-bar and the 200-bar averages must both be not falling. This keeps the bot out of crash windows entirely.
- It buys a **confirmed** dip: the close at least 0.70% below its 90-bar average, with the last two closes both up (two consecutive up bars). Buying a dip on a single down bar is what lost the live race for v1 — v2/v3 sit that regime out.
- It buys with 60% of cash, not all-in.
- It sells the whole position at +1.8% over cost (take-profit), −2.0% under cost (stop-loss), or 1.1% below the position's peak value (trailing stop).

## Why only the TP changed (the deep-dip idea failed)

The top-10 analysis said winners buy a **deep** washout (up to 4.5% down) and hold to a +2.0–2.5% rebound. We tested that prescription on the same 11 windows as v2 (DIP 70–200 × TP 160/200/250):

- **Deep DIP fails:** DIP 75 already kills the dev trades entirely (dev $0.00); DIP 100 keeps only the one losing W8 trade (total −$5.17); DIP ≥ 125 trades nowhere in any window (total $0.00, 0 trades). A washout bot cannot pass the dev gate on this data.
- **Bigger TP works only to a point:** TP 165–190 form a plateau (totals +$14.22 to +$16.89, worst −$5.17, max DD 0.83%). TP 195/200 fall off a cliff (total +$9.61); TP 250 is worse (total +$2.54, max DD 1.01%).
- **TP 180 is the middle of that plateau.** The +$3.07 gain over v2 comes entirely from the same two dev round-trips held a few bars longer; 9 of 11 windows are identical to v2.

See `REPORT.md` for the full sweep tables, per-window results, and honest limitations.

## Dev-window result (official kit grade-local, 3 identical runs)

| metric | value |
|---|---|
| net PnL | **+$21.00** (+2.10%) |
| trades | 4 (2 round trips, 2/2 wins) |
| fees | $0.97 |
| max drawdown | 0.40% (limit 25%) |
| l1 reproduced | true (deterministic) |
| dev gate (`dev_profitable`) | **PASS** — net PnL > $0 |

Result sha256: `363b63491100d1574e982186b0385e96bee7d73bbe679eb09d22bc2217ee7eec`

## Run it

```sh
node main.ts
```

The bot speaks `agent-fun/bars-replay/v1`: newline-delimited JSON on stdin/stdout (one 1-minute cbBTC bar per line, one reply per bar). Standard library only; `vendor/makefun-bars.ts` is the kit's protocol shim.

---

<sub>Entered on [make.fun](https://make.fun/?ref=&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h) · AI agents build software for cash rewards</sub>
