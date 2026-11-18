/**
 * BTC washout bot v4 for make.fun btc-race-24h (bars-replay/v1).
 *
 * Successor to v3 (commit deaa490, dev +$21.00 on the 0603 window, but
 * $0.00 / 0 trades on the 1444 window — it FAILS this race's dev gate).
 *
 * v4 is a TRUE washout bot, built on a different architecture. The top-10
 * analysis found the live winners buy ONE deep washout (~4.5% down) and
 * hold to a +2.0-2.5% rebound, 1-2 trades, exposure <= 0.15. v3 could not
 * do that: its dip is measured vs SMA-90, and in a falling window the SMA
 * itself falls with the price, so the dip never looks deep enough — and
 * the SMA not-falling filters block the deeper dips outright. Raising
 * v3's DIP to 75 already killed its dev trades entirely.
 *
 * v4 measures the dip vs a ROLLING HIGH instead of a moving average. A
 * high is a fixed anchor: it does not fall with the price, so a -2.0%
 * drawdown from the high DOES fire in a falling knife. The reversal
 * confirmation (this close above the previous close) keeps the bot from
 * buying mid-fall — that is the exact failure that lost v1's live race.
 *
 * Parameters (swept on the two authoritative dev windows, 1,728 combos;
 * the pick sits on a plateau, not a peak — see REPORT.md):
 *   rolling high window 240 bars (4h), entry -2.0% below the high,
 *   confirmation one up close, TP +1.8% over cost, trailing 1.1% from
 *   peak value, hard SL -2.0% under cost, size 60% of cash, MAX 1 trade
 *   per 24h (no re-entry after exit).
 *
 * Backtest (independent backtester that reproduces the kit grader
 * bit-for-bit on v1/v2/v3):
 *   1444 dev (this race): +$10.26, 1 round trip, 100% win, 0.39% max DD.
 *     buys bar 241 ~$63,749 (the washout bottom) -> sells bar 503
 *     ~$64,892 (the rebound high). The washout trade, exactly as the
 *     top 10 make it.
 *   0603 dev (previous race): +$10.82, 1 round trip, 100% win, 0.37% max DD.
 *   Total across both dev windows: +$21.08 (v3: +$21.00 — and v3 scores
 *   $0.00 on the 1444 window, so it cannot race here at all).
 *   12-window total (both dev + 10 Coinbase proxies): +$16.02, worst
 *   -$5.81 (v3: +$15.82, worst -$5.17, positive on only 1 of 12).
 *
 * Honest limitation: one trade cannot match v3's TWO winning round trips
 * on the flat 0603 window (+$21.00 there); v4 makes +$10.82 on it. That
 * is structural — a 1-trade, 60%-size bot cannot print +$21 on a window
 * whose biggest single move is ~2%. v4 wins where it matters for THIS
 * race (it passes the 1444 gate; v3 fails it) and is positive on both
 * dev windows, while v3 is flat on one of them.
 *
 * All arithmetic is BigInt (closes, sums and values are integers), so the
 * same bars always give the same orders. No clock, no network, no files, no
 * randomness.
 */

import { runBars } from './vendor/makefun-bars.ts';
import type { BarsState, Batch, OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

// Strategy parameters (see REPORT.md for how they were chosen).
const HIGH_BARS = 240; // rolling-high window (bars)
const DD_BPS = 200n; // buy when close is this many bps below the rolling high
const TP_BPS = 180n; // sell when the position is this many bps over its cost
const STOP_BPS = 200n; // sell when the position is this many bps under its cost
const TRAIL_BPS = 110n; // sell when the position falls this many bps from its peak value
const SIZE_BPS = 6000n; // buy with this many bps of cash (60%), not all-in
const MAX_TRADES = 1; // at most one round trip per 24h window
const MAX_SLIPPAGE_BPS = 100; // 1% past the close the order was decided on
const BPS = 10_000n;

// Close history (bigint, price raw units, price_scale 5).
const closes: bigint[] = [];
// Peak value of the open position (quote units); 0 while flat.
let peakValue = 0n;
// Round trips completed; the bot never re-enters after its one trade.
let tradesDone = 0;

function rollingHigh(): bigint {
  let high = 0n;
  const start = closes.length - HIGH_BARS;
  for (let k = start; k < closes.length; k++) {
    if (closes[k] > high) high = closes[k];
  }
  return high;
}

function onBatch(state: BarsState, batch: Batch): OrderInput[] {
  // Only the CBBTC bar of this batch matters; a batch without one is a gap.
  const bar = batch.bars.find((b) => b.symbol === SYMBOL);
  if (bar === undefined) return [];
  closes.push(BigInt(bar.c));
  if (state.warmingUp) return [];

  const held = state.positions.get(SYMBOL);
  if (held === undefined) {
    // Flat: look for a washout to buy — at most one trade per window.
    peakValue = 0n;
    if (tradesDone >= MAX_TRADES) return [];
    // Need a full high window plus one older close for the confirmation.
    if (closes.length < HIGH_BARS + 2) return [];
    const close = closes[closes.length - 1];
    // Drawdown: close at least DD_BPS below the rolling high.
    //   close * 10000 <= high * (10000 - DD_BPS)
    const high = rollingHigh();
    if (close * BPS > high * (BPS - DD_BPS)) return [];
    // Confirmation: the turn must be real — this close above the last.
    // (Buying while still falling is catching a knife: that is exactly
    // the trade that lost the live race for v1.)
    if (close <= closes[closes.length - 2]) return [];
    const cash = state.cash;
    const notional = (cash * SIZE_BPS) / BPS;
    if (notional < BigInt(state.hello.fees.min_notional_quote_units)) return [];
    tradesDone += 1;
    return [
      {
        side: 'buy',
        symbol: SYMBOL,
        notional_quote_units: notional,
        max_slippage_bps: MAX_SLIPPAGE_BPS,
      },
    ];
  }

  // Holding: take-profit, trailing stop, or stop-loss on the position's
  // value vs its cost.
  const value = state.value(SYMBOL, held.qty);
  const cost = held.cost;
  if (cost <= 0n) return [];
  if (value > peakValue) peakValue = value;
  // value >= cost * (1 + TP_BPS/10000)
  if (value * BPS >= cost * (BPS + TP_BPS)) {
    return [
      {
        side: 'sell',
        symbol: SYMBOL,
        qty: held.qty,
        max_slippage_bps: MAX_SLIPPAGE_BPS,
      },
    ];
  }
  // value <= peakValue * (1 - TRAIL_BPS/10000) — bank a stalled bounce.
  if (peakValue > 0n && value * BPS <= peakValue * (BPS - TRAIL_BPS)) {
    return [
      {
        side: 'sell',
        symbol: SYMBOL,
        qty: held.qty,
        max_slippage_bps: MAX_SLIPPAGE_BPS,
      },
    ];
  }
  // value <= cost * (1 - STOP_BPS/10000)
  if (value * BPS <= cost * (BPS - STOP_BPS)) {
    return [
      {
        side: 'sell',
        symbol: SYMBOL,
        qty: held.qty,
        max_slippage_bps: MAX_SLIPPAGE_BPS,
      },
    ];
  }
  return [];
}

await runBars({ onBatch });
