import 'server-only'

import { countLive, getSnapshot, listLiveCalls } from '@/lib/store/calls'
import type { LiveCall } from '@/lib/data/calls'

export interface CallFilter {
  agent?: string
  minV2vMs?: number
  negativeSentiment?: boolean
}

export async function sliceCalls(
  tenantId: string,
  offset: number,
  limit: number,
  filter?: CallFilter,
): Promise<LiveCall[]> {
  const live = await listLiveCalls(tenantId)
  return live.filter((call) => matches(call, filter)).slice(offset, offset + limit)
}

export async function countCalls(tenantId: string, filter?: CallFilter): Promise<number> {
  if (!filter) return countLive(tenantId)
  const live = await listLiveCalls(tenantId)
  return live.filter((call) => matches(call, filter)).length
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
