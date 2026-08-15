'use client'

import { useCallback, useState } from 'react'
import { LiveCallGrid, type FilterKey } from '@/components/ops/LiveCallGrid'
import { MonitorHeader } from '@/components/ops/MonitorHeader'
import { EndedCallsStrip } from '@/components/ops/EndedCallsStrip'
import { useLiveFeed } from '@/lib/runtime'

export default function LiveCallsPage() {
  const { liveCount } = useLiveFeed()
  const [filterKey, setFilterKey] = useState<FilterKey>('all')
  const [counts, setCounts] = useState({ total: liveCount, slow: 0, negative: 0 })
  const onCounts = useCallback((next: typeof counts) => setCounts(next), [])

  return (
    <>
      <MonitorHeader filterKey={filterKey} onFilter={setFilterKey} counts={counts} />
      <LiveCallGrid filterKey={filterKey} onCounts={onCounts} />
      <EndedCallsStrip />
    </>
  )
}
