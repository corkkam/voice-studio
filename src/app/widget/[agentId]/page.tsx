import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'
import { getAgentById } from '@/lib/store/agents'
import { WidgetClient } from '@/components/widget/WidgetClient'

export default async function WidgetPage({
  params,
}: {
  params: Promise<{ agentId: string }>
}) {
  const { agentId } = await params
  const agent = getAgentById(agentId)
  if (!agent) notFound()

  return (
    <div data-theme="light" className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <WidgetClient agentId={agent.id} agentName={agent.name} />
    </div>
  )
}
