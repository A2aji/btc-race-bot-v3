/**
 * BTC swing bot v3 for make.fun btc-race-24h (bars-replay/v1).
 *
 * Successor to v2 (commit e7604fe, dev +$17.93, 11-window total +$12.75).
 * v3 changes exactly ONE parameter: take-profit 1.6% -> 1.8%.
 *
 * Why: the top-10 analysis said the winners buy a deep washout and hold
 * until the rebound finishes (+2.0-2.5%), and that v2's TP (+1.6%) cut
 * winners short. We tested that prescription on the same 11 windows
 * (DIP 70-200 x TP 160/200/250, plus a fine TP scan 160-200):
 *   - The DEEP-DIP half of the prescription FAILED empirically. DIP 75
 *     already kills the dev trades entirely (dev $0.00); DIP 100 keeps
 *     only the one losing W8 trade (total -$5.17); DIP >= 125 trades
 *     NOWHERE in any of the 11 windows (total $0.00, 0 trades). A
 *     washout bot cannot pass the dev gate on this data, so DIP stays 70.
 *   - The BIGGER-TP half works, but only up to a point: TP 165-190 form
 *     a plateau (totals +$14.22 to +$16.89, worst -$5.17, max DD 0.83%,
 *     dev +$19.39 to +$22.06, same 6 trades as v2). TP 195/200 fall off
 *     a cliff (total +$9.61) because the second dev trade then misses
 *     its TP and gets banked by the trailing stop for only +$3.62.
 *     TP 250 is worse still (total +$2.54, max DD 1.01%).
 *   - TP 180 is the middle of the 165-190 plateau and reproduces the
 *     +$15.82 total v2's own report already measured at TP 180.
 * The gain (+$3.07 over v2) comes entirely from the same two dev
 * round-trips held a few bars longer (sell bars 512 vs 510 and 960 vs
 * 936); 9 of 11 windows are byte-identical to v2. This is NOT a washout
 * bot and will not win a washout race the way the top 10 did ($14-31 in
 * one window) - it banks slightly more on the same dev-type bounce while
 * keeping v2's downside bound (worst -$5.17, max DD 0.83%).
 *
 * Everything else is v2 unchanged: confirmed-dip entry (close >= 0.70%
 * below the 90-bar average AND two consecutive up closes), SMA-200
 * not-falling filter, SL -2.0%, trailing stop 1.1% from peak, 60% size.
 *
 * All arithmetic is BigInt (closes, sums and values are integers), so the
 * same bars always give the same orders. No clock, no network, no files, no
 * randomness.
 *
 * Multi-window backtest (11 x 24h windows, independent backtester that
 * reproduces the kit grader bit-for-bit on v1: +$25.50 dev):
 * net +$15.82 across all 11 windows (mean +$1.44/window), worst window
 * -$5.17, dev +$21.00 (4 trades, 2/2 wins, 0.40% max drawdown).
 * v2 on the same windows: net +$12.75, worst -$5.17, dev +$17.93.
 */

import { runBars } from './vendor/makefun-bars.ts';
import type { BarsState, Batch, OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

// Strategy parameters (see REPORT.md for how they were chosen).
const SLOW_BARS = 90; // slow average window (bars)
const LONG_BARS = 200; // long average window (bars)
const DIP_BPS = 70n; // buy when close is this many bps below the slow average
const TP_BPS = 180n; // sell when the position is this many bps over its cost (v3: 180, was 160 in v2 — mid-plateau of the 165-190 TP scan; see REPORT.md)
const STOP_BPS = 200n; // sell when the position is this many bps under its cost
const TRAIL_BPS = 110n; // sell when the position falls this many bps from its peak value
const SIZE_BPS = 6000n; // buy with this many bps of cash (60%), not all-in
const REGIME_BPS = 10n; // an average must be within this many bps of the close
// that many bars ago (i.e. not falling)
const MAX_SLIPPAGE_BPS = 100; // 1% past the close the order was decided on
const BPS = 10_000n;

// Close history (bigint, price raw units, price_scale 5).
const closes: bigint[] = [];
// Peak value of the open position (quote units); 0 while flat.
let peakValue = 0n;

function sumLast(n: number): bigint {
  let total = 0n;
  for (let k = closes.length - n; k < closes.length; k++) total += closes[k];
  return total;
}

function onBatch(state: BarsState, batch: Batch): OrderInput[] {
  // Only the CBBTC bar of this batch matters; a batch without one is a gap.
  const bar = batch.bars.find((b) => b.symbol === SYMBOL);
  if (bar === undefined) return [];
  closes.push(BigInt(bar.c));
  if (state.warmingUp) return [];

  const held = state.positions.get(SYMBOL);
  if (held === undefined) {
    // Flat: look for a confirmed dip to buy.
    peakValue = 0n;
    // Need a full long window plus one older close for the regime check.
    if (closes.length < LONG_BARS + 2) return [];
    const close = closes[closes.length - 1];
    // Dip: close at least DIP_BPS below the slow average.
    //   close * SLOW_BARS * 10000 < totalSlow * (10000 - DIP_BPS)
    const totalSlow = sumLast(SLOW_BARS);
    if (close * BigInt(SLOW_BARS) * BPS >= totalSlow * (BPS - DIP_BPS)) return [];
    // Regime: slow average not falling: average >= close 91 bars ago
    // (within 0.1%).
    const oldSlow = closes[closes.length - SLOW_BARS - 2];
    if (totalSlow * BPS < oldSlow * (BPS - REGIME_BPS) * BigInt(SLOW_BARS)) return [];
    // Long regime: long average not falling: average >= close 200 bars
    // ago (within 0.1%).
    const totalLong = sumLast(LONG_BARS);
    const oldLong = closes[closes.length - LONG_BARS - 1];
    if (totalLong * BPS < oldLong * (BPS - REGIME_BPS) * BigInt(LONG_BARS)) return [];
    // Confirmation: the turn must be real — the last two closes both up.
    // (A single down bar that merely "looks cheap" is a falling knife:
    // that is exactly the trade that lost the live race for v1.)
    if (close <= closes[closes.length - 2]) return [];
    if (closes[closes.length - 2] <= closes[closes.length - 3]) return [];
    const cash = state.cash;
    const notional = (cash * SIZE_BPS) / BPS;
    if (notional < BigInt(state.hello.fees.min_notional_quote_units)) return [];
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
