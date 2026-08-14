'use client'

import { useState } from 'react'
import { Eyebrow } from '@/components/ui/primitives'

export function ConnectPanel({
  agentId,
  agentName,
  baseUrl,
  published,
}: {
  agentId: string
  agentName: string
  baseUrl: string
  published: boolean
}) {
  const [copied, setCopied] = useState<string | null>(null)

  const widget = `<script src="${baseUrl}/sdk/voice-studio.js"></script>
<script>
  VoiceStudio.mount({
    baseUrl: ${JSON.stringify(baseUrl)},
    apiKey: "vs_pk_live_YOUR_PUBLISHABLE_KEY",
    agentId: ${JSON.stringify(agentId)},
    channel: "web"
  });
</script>`

  const js = `import { VoiceStudio } from "@voice-studio/sdk";

const client = new VoiceStudio({
  baseUrl: ${JSON.stringify(baseUrl)},
  apiKey: process.env.VOICE_STUDIO_KEY,
  agentId: ${JSON.stringify(agentId)},
});

const session = await client.connect({
  channel: "web",
  display: "Checkout visitor",
});

session.on("transcript", (turn) => console.log(turn));
await session.sendText("Hello");`

  const swift = `import VoiceStudio

let client = VoiceStudioClient(
  baseURL: URL(string: ${JSON.stringify(baseUrl)})!,
  apiKey: ProcessInfo.processInfo.environment["VOICE_STUDIO_KEY"]!,
  agentId: ${JSON.stringify(agentId)}
)

let session = try await client.connect(channel: .macos, display: Host.current().localizedName)
session.onTranscript = { print($0.text) }
try await session.sendText("Hello from the Mac app")`

  const curl = `curl -X POST ${baseUrl}/api/v1/sessions \\
  -H "Authorization: Bearer vs_sk_live_YOUR_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"agentId":"${agentId}","channel":"api","display":"CRM ticket 1842"}'`

  function copy(id: string, value: string) {
    void navigator.clipboard.writeText(value)
    setCopied(id)
    window.setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="rounded-[9px] border border-line bg-panel px-[14px] py-[13px]">
      <div className="mb-[10px] flex items-baseline justify-between gap-3">
        <div>
          <div className="font-sans text-[12px] font-semibold text-ink">Connect {agentName}</div>
          <p className="mt-[5px] font-sans text-[11.5px] text-muted">
            Web widget, JS SDK, REST, or the Swift client. Audio stays on the device; the control
            plane only sees sessions and turns.
          </p>
        </div>
        <a href="/keys" className="font-sans text-[11px] font-semibold text-accent-deep">
          API keys →
        </a>
      </div>
      {!published ? (
        <p className="mb-3 rounded-[6px] bg-accent-tint px-3 py-2 font-sans text-[11.5px] text-accent-deep">
          Publish this agent before a publishable key can open a public session. Studio test calls
          work on drafts.
        </p>
      ) : null}

      <Snippet id="widget" title="Web widget" value={widget} copied={copied} onCopy={copy} />
      <Snippet id="js" title="JavaScript SDK" value={js} copied={copied} onCopy={copy} />
      <Snippet id="swift" title="macOS / iOS (Swift)" value={swift} copied={copied} onCopy={copy} />
      <Snippet id="curl" title="REST · any platform" value={curl} copied={copied} onCopy={copy} />

      <Eyebrow className="mt-3">WIDGET PREVIEW</Eyebrow>
      <a
        href={`/widget/${agentId}`}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block font-sans text-[11.5px] font-semibold text-accent-deep"
      >
        Open standalone widget →
      </a>
    </div>
  )
}

function Snippet({
  id,
  title,
  value,
  copied,
  onCopy,
}: {
  id: string
  title: string
  value: string
  copied: string | null
  onCopy: (id: string, value: string) => void
}) {
  return (
    <div className="mt-3 overflow-hidden rounded-[7px] border border-line-3">
      <div className="flex items-center justify-between bg-panel-2 px-3 py-[7px]">
        <span className="font-mono text-[10px] font-semibold tracking-[0.06em] text-muted-4">
          {title.toUpperCase()}
        </span>
        <button
          type="button"
          onClick={() => onCopy(id, value)}
          className="font-sans text-[10.5px] font-semibold text-accent-deep"
        >
          {copied === id ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-2 font-mono text-[10.5px] leading-[1.5] text-ink-3">
        {value}
      </pre>
    </div>
  )
}
