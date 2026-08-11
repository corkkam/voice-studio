import Link from 'next/link'
import { Eyebrow } from '@/components/ui/primitives'
import {
  CALL,
  CALL_METRICS,
  RETENTION,
  TRACE,
  TRANSCRIPT,
  TURN_5_SPANS,
  TURN_LATENCY,
  recordingWaveform,
} from '@/lib/data/callDetail'

const BAND_COLOR: Record<string, string> = {
  agent: '#e4572e',
  caller: '#6b7f78',
  silence: '#3a322b',
}

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ callId: string }>
}) {
  const { callId } = await params
  const bars = recordingWaveform()

  return (
    <>
      <header className="flex min-h-[64px] flex-none flex-wrap items-center gap-x-4 gap-y-2 border-b border-ops-line px-[22px] py-[10px]">
        <div className="font-sans text-[12px] leading-none font-medium text-ops-muted-2">
          <Link href={`/campaigns/${CALL.campaignId}`} className="text-ops-ink-3 hover:text-ops-ink">
            ← {CALL.campaign}
          </Link>
          <span className="mx-[7px] text-ops-faint-3">/</span>
          <Link href="/calls" className="hover:text-ops-ink-3">
            Calls
          </Link>
          <span className="mx-[7px] text-ops-faint-3">/</span>
          <span className="font-mono text-[12px] font-semibold text-ops-ink">{callId}</span>
        </div>

        <div className="flex flex-wrap items-center gap-[9px]">
          <span className="rounded-[5px] border border-ops-line bg-ops-raised px-2 py-[5px] font-mono text-[10.5px] leading-none font-medium text-ops-ink">
            {CALL.number}
          </span>
          <span className="font-mono text-[10.5px] leading-none font-medium text-ops-muted-2">
            {CALL.duration}
          </span>
          <span className="rounded-[5px] border border-ops-good-line bg-ops-good-bg px-2 py-[5px] font-mono text-[10.5px] leading-none font-medium text-ops-good-2">
            {CALL.outcome}
          </span>
        </div>

        <div className="ml-auto flex flex-wrap gap-[7px]">
          <button
            type="button"
            className="rounded-[6px] border border-ops-line px-[11px] py-[7px] font-sans text-[11px] leading-none font-semibold text-ops-ink-3 hover:bg-ops-raised"
          >
            Export transcript
          </button>
          <button
            type="button"
            className="rounded-[6px] border border-ops-line px-[11px] py-[7px] font-sans text-[11px] leading-none font-semibold text-ops-ink-3 hover:bg-ops-raised"
          >
            Add to eval set
          </button>
          <button
            type="button"
            className="rounded-[6px] bg-accent px-[11px] py-[7px] font-sans text-[11px] leading-none font-semibold text-ops-bg"
          >
            Replay in sim
          </button>
        </div>
      </header>

      {/*
        This one stays a waveform on purpose: it is the recording's own
        amplitude over 3:41 and doubles as the seek bar. The orbs replaced the
        live agent-activity waveforms, not the audio itself.
      */}
      <section className="flex flex-none flex-wrap items-end gap-x-[26px] gap-y-3 border-b border-ops-line px-[22px] py-[14px]">
        <div className="flex h-[44px] min-w-[280px] flex-1 items-center gap-px">
          {bars.map((bar, i) => (
            <div
              key={i}
              className="min-w-px flex-1"
              style={{ height: `${bar.h}%`, background: BAND_COLOR[bar.band] }}
            />
          ))}
        </div>
        <div className="flex gap-4 pb-[3px] font-mono text-[10.5px] leading-none font-medium text-ops-muted-2">
          <span>
            <span className="mr-[5px] inline-block h-[7px] w-[7px] rounded-[2px] bg-accent align-middle" />
            agent
          </span>
          <span>
            <span className="mr-[5px] inline-block h-[7px] w-[7px] rounded-[2px] bg-[#6b7f78] align-middle" />
            caller
          </span>
          <span className="text-ops-ink-3">0:00 / {CALL.duration}</span>
        </div>
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[1fr_520px]">
        {/* Transcript */}
        <div className="flex min-h-0 flex-col gap-[14px] overflow-y-auto px-[22px] py-[18px]">
          <div className="flex flex-wrap items-center gap-[9px]">
            <Eyebrow tone="ops">TRANSCRIPT · DIARIZED</Eyebrow>
            <span className="rounded-[4px] border border-ops-line px-[6px] py-[3px] font-mono text-[10px] leading-none font-medium text-ops-muted-2">
              word-level ts
            </span>
            <span className="rounded-[4px] border border-ops-good-line bg-ops-good-bg px-[6px] py-[3px] font-mono text-[10px] leading-none font-medium text-ops-good-2">
              PII redacted before export
            </span>
          </div>

          <div className="flex flex-col gap-[13px]">
            {TRANSCRIPT.map((turn, i) => (
              <div
                key={i}
                className={`grid grid-cols-[52px_1fr] gap-3 ${
                  turn.selected
                    ? '-ml-[14px] rounded-r-[8px] border-l-2 border-accent bg-ops-selected py-[10px] pl-3'
                    : ''
                }`}
              >
                <div
                  className={`font-mono text-[10.5px] leading-[1.5] font-medium ${
                    turn.selected ? 'text-ops-ink-3' : 'text-ops-faint-2'
                  }`}
                >
                  {turn.at}
                </div>
                <div>
                  <div className="mb-[5px] flex items-center gap-2">
                    <span
                      className={`font-mono text-[10px] leading-none font-semibold ${
                        turn.speaker === 'AGENT' ? 'text-accent' : 'text-ops-caller'
                      }`}
                    >
                      {turn.speaker}
                    </span>
                    {turn.selectedNote ? (
                      <span className="font-mono text-[9.5px] leading-none font-medium text-ops-muted-2">
                        {turn.selectedNote}
                      </span>
                    ) : null}
                  </div>

                  <div
                    className={`font-sans text-[12.5px] leading-[1.6] ${
                      turn.selected ? 'text-ops-ink' : 'text-ops-ink-2'
                    }`}
                  >
                    {turn.redacted ? (
                      <>
                        {turn.redacted.before}
                        <span className="rounded-[3px] bg-ops-line px-[5px] py-px font-mono text-[11px] font-medium text-ops-muted-2">
                          {turn.redacted.token}
                        </span>
                        {turn.redacted.after}
                      </>
                    ) : (
                      turn.text
                    )}
                    {turn.aside ? (
                      <span className="ml-1 font-mono text-[10px] text-ops-muted-3">
                        {turn.aside}
                      </span>
                    ) : null}
                  </div>

                  {turn.tools?.length || turn.notes?.length ? (
                    <div className="mt-[6px] flex flex-wrap gap-[6px]">
                      {turn.tools?.map((tool) => (
                        <span
                          key={tool}
                          className="rounded-[4px] bg-ops-raised px-[6px] py-[3px] font-mono text-[9.5px] leading-none font-medium text-ops-ink-3"
                        >
                          {tool}
                        </span>
                      ))}
                      {turn.notes?.map((note) => (
                        <span
                          key={note}
                          className="rounded-[4px] border border-ops-line px-[6px] py-[3px] font-mono text-[9.5px] leading-none font-medium text-ops-muted-2"
                        >
                          {note}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trace + metrics rail */}
        <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto border-t border-ops-line bg-ops-panel-4 p-[18px] xl:border-t-0 xl:border-l">
          <div>
            <div className="mb-[11px] flex items-baseline justify-between gap-2">
              <Eyebrow tone="ops">TURN 5 · OTEL SPANS</Eyebrow>
              <span className="font-mono text-[10.5px] leading-none font-medium text-ops-muted-2">
                trace {TRACE.id} · <span className="text-ops-ink">{TRACE.v2vMs} ms v2v</span>
              </span>
            </div>

            <div className="flex flex-col gap-[7px]">
              {TURN_5_SPANS.map((span) => (
                <div key={span.name} style={{ paddingLeft: span.depth * 14 }}>
                  <div
                    className={`mb-1 flex justify-between font-mono text-[10.5px] leading-none font-medium ${
                      span.depth === 0 ? 'text-ops-ink-3' : 'text-ops-muted-2'
                    }`}
                  >
                    <span>{span.name}</span>
                    <span>{span.ms} ms</span>
                  </div>
                  <div className="relative h-[9px] overflow-hidden rounded-[2px] bg-ops-raised">
                    <div
                      className="absolute top-0 h-full"
                      style={{
                        left: `${span.offsetPct}%`,
                        width: `${span.widthPct}%`,
                        background: span.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-ops-line pt-[14px]">
            <Eyebrow tone="ops" className="mb-[11px]">
              CALL METRICS
            </Eyebrow>
            <div className="grid grid-cols-2 gap-[10px]">
              {CALL_METRICS.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-[8px] border border-ops-line bg-ops-panel-2 px-[11px] py-[10px]"
                >
                  <div className="font-sans text-[10.5px] leading-none text-ops-muted-2">
                    {metric.label}
                  </div>
                  <div className="mt-[7px] font-mono text-[14px] leading-none font-semibold text-ops-ink">
                    {metric.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-ops-line pt-[14px]">
            <Eyebrow tone="ops" className="mb-[11px]">
              RETENTION
            </Eyebrow>
            <div className="flex flex-col gap-[7px] font-mono text-[10.5px] leading-none font-medium text-ops-muted-2">
              {RETENTION.map((row) => (
                <div key={row.label} className="flex justify-between gap-3">
                  <span>{row.label}</span>
                  <span className="flex-none text-ops-ink-3">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-ops-line pt-[14px]">
            <div className="mb-[11px] flex items-baseline justify-between">
              <Eyebrow tone="ops">PER-TURN LATENCY · AGENT TURNS</Eyebrow>
              <span className="font-mono text-[10px] leading-none font-medium text-ops-muted-3">
                ms
              </span>
            </div>

            <div className="grid grid-cols-[0.9fr_0.7fr_0.7fr_0.7fr_0.8fr] gap-2 border-b border-ops-line-2 px-[2px] pb-[7px] font-mono text-[9.5px] leading-none font-medium text-ops-muted-3">
              <div>TURN</div>
              <div className="text-right">STT</div>
              <div className="text-right">LLM</div>
              <div className="text-right">TTS</div>
              <div className="text-right">V2V</div>
            </div>

            {TURN_LATENCY.map((row) => (
              <div
                key={row.turn}
                className={`grid grid-cols-[0.9fr_0.7fr_0.7fr_0.7fr_0.8fr] gap-2 px-[2px] py-[7px] font-mono text-[11px] leading-none ${
                  row.selected
                    ? 'my-px rounded-[5px] bg-ops-raised font-semibold text-ops-ink'
                    : 'border-b border-ops-line-3 font-medium text-ops-ink-3'
                }`}
              >
                <div className={row.selected ? 'text-accent' : 'text-ops-muted-3'}>{row.turn}</div>
                <div className={`text-right ${row.stt === '—' ? 'text-ops-faint-2' : ''}`}>
                  {row.stt}
                </div>
                <div className="text-right">{row.llm}</div>
                <div className="text-right">{row.tts}</div>
                <div className={`text-right ${row.selected ? '' : 'text-ops-ink'}`}>{row.v2v}</div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </>
  )
}
