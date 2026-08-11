'use client'

import { useCallback, useState } from 'react'
import { LiveCallGrid, type FilterKey } from '@/components/ops/LiveCallGrid'
import { MonitorHeader } from '@/components/ops/MonitorHeader'
import { EndedCallsStrip } from '@/components/ops/EndedCallsStrip'
import { TOTAL_LIVE } from '@/lib/data/callStore'

export default function LiveCallsPage() {
  const [filterKey, setFilterKey] = useState<FilterKey>('all')
  const [counts, setCounts] = useState({ total: TOTAL_LIVE, slow: 0, negative: 0 })

  const onCounts = useCallback((next: typeof counts) => setCounts(next), [])

  return (
    <>
      <MonitorHeader filterKey={filterKey} onFilter={setFilterKey} counts={counts} />
      <LiveCallGrid filterKey={filterKey} onCounts={onCounts} />
      <EndedCallsStrip />
    </>
  )
}
