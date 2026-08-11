import type { CallActivity } from '@/lib/activity'
import { LIVE_CALLS, type LiveCall } from '@/lib/data/calls'

/**
 * Lazy, windowed access to the live-call set.
 *
 * The monitor must stay upright whether there are 12 calls in flight or
 * 120,000. The rule that makes that true: nothing is ever materialised for a
 * call the operator cannot currently see. `callAt(i)` synthesises one call on
 * demand from a deterministic seed, so memory and DOM cost track the viewport,
 * not the fleet — `TOTAL` can be raised by three orders of magnitude without
 * changing a single allocation.
 *
 * The same shape is what a real backend would expose (offset/limit over a
 * server-side count), so swapping this module for an HTTP adapter is a
 * one-file change: keep `count()` and `slice()`, drop the generator.
 */

export interface CallFilter {
  agent?: string
  /** Only calls whose measured voice-to-voice exceeds this. */
  minV2vMs?: number
  /** Only calls trending negative. */
  negativeSentiment?: boolean
}

/** Archetypes the synthetic fleet is drawn from — the five hand-written cards. */
const ARCHETYPES = LIVE_CALLS

const IN_PREFIXES = ['98', '91', '76', '70', '88', '63', '99', '80', '74', '96', '82', '77']

/** Mulberry32 — deterministic per index, so a call looks the same every render. */
function rand(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * How many calls the media plane currently has in flight. In a real deployment
 * this is a counter read from the concurrency pool; here it is the knob that
 * proves the monitor scales.
 */
export const TOTAL_LIVE = 1284

export function callAt(index: number): LiveCall {
  // The first few indices are the hand-written archetypes, verbatim, so the
  // designed states (failover, warm transfer, interview) are always on screen.
  if (index < ARCHETYPES.length) return ARCHETYPES[index]

  const r = rand(index * 2654435761)
  const base = ARCHETYPES[index % ARCHETYPES.length]
  const prefix = IN_PREFIXES[Math.floor(r() * IN_PREFIXES.length)]
  const tail = String(Math.floor(r() * 9000) + 1000)

  // Most calls are healthy; a small tail is degraded. Keeps the alert states
  // rare enough to still mean something when scrolling a long fleet.
  const roll = r()
  const activity: CallActivity =
    roll > 0.96 ? 'recovering' : roll > 0.92 ? 'transferring' : roll > 0.62 ? 'speaking' : roll > 0.3 ? 'listening' : 'thinking'

  const v2vMs = activity === 'recovering' ? 980 + Math.floor(r() * 400) : 560 + Math.floor(r() * 320)

  return {
    ...base,
    id: `call_sim_${index.toString(36).padStart(6, '0')}`,
    display: `+91 ${prefix}•••• ${tail}`,
    elapsedSec: 10 + Math.floor(r() * 400),
    v2vMs,
    activity,
    alert: activity === 'recovering',
    footTone: activity === 'recovering' ? 'alert' : base.footTone,
  }
}

function matches(call: LiveCall, filter?: CallFilter): boolean {
  if (!filter) return true
  if (filter.agent && call.agent !== filter.agent) return false
  if (filter.minV2vMs !== undefined && call.v2vMs <= filter.minV2vMs) return false
  if (filter.negativeSentiment && call.footTone !== 'alert') return false
  return true
}

/**
 * A window of calls. Filtering walks forward from the offset rather than
 * building the full filtered array, so a filter that matches 4 of 1,284 calls
 * costs the same as one that matches all of them.
 */
export function sliceCalls(
  offset: number,
  limit: number,
  filter?: CallFilter,
  total: number = TOTAL_LIVE,
): LiveCall[] {
  const out: LiveCall[] = []
  if (!filter) {
    for (let i = offset; i < Math.min(offset + limit, total); i++) out.push(callAt(i))
    return out
  }

  let seen = 0
  for (let i = 0; i < total && out.length < limit; i++) {
    const call = callAt(i)
    if (!matches(call, filter)) continue
    if (seen++ < offset) continue
    out.push(call)
  }
  return out
}

/**
 * Count matching a filter. Capped scan — past the cap we report an estimate
 * rather than walking a six-figure fleet on every keystroke.
 */
const COUNT_SCAN_CAP = 4000

export function countCalls(filter?: CallFilter, total: number = TOTAL_LIVE): number {
  if (!filter) return total
  const scan = Math.min(total, COUNT_SCAN_CAP)
  let hits = 0
  for (let i = 0; i < scan; i++) if (matches(callAt(i), filter)) hits++
  return scan === total ? hits : Math.round((hits / scan) * total)
}
