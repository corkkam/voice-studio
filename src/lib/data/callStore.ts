import 'server-only'

import { countLive, getSnapshot, listLiveCalls } from '@/lib/store/calls'
import type { LiveCall } from '@/lib/data/calls'

export interface CallFilter {
  agent?: string
  minV2vMs?: number
  negativeSentiment?: boolean
}

export function sliceCalls(
  tenantId: string,
  offset: number,
  limit: number,
  filter?: CallFilter,
): LiveCall[] {
  return listLiveCalls(tenantId)
    .filter((call) => matches(call, filter))
    .slice(offset, offset + limit)
}

export function countCalls(tenantId: string, filter?: CallFilter): number {
  if (!filter) return countLive(tenantId)
  return listLiveCalls(tenantId).filter((call) => matches(call, filter)).length
}

export function snapshotFor(tenantId: string) {
  return getSnapshot(tenantId)
}

function matches(call: LiveCall, filter?: CallFilter): boolean {
  if (!filter) return true
  if (filter.agent && call.agent !== filter.agent) return false
  if (filter.minV2vMs !== undefined && call.v2vMs <= filter.minV2vMs) return false
  if (filter.negativeSentiment && call.footTone !== 'alert') return false
  return true
}
