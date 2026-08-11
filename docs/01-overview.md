# 01 — Overview

## What we are building

A multi-tenant voice-AI platform for the Indian market. Tenants configure a voice
agent, point it at a phone number or a web room, and the platform runs the
conversation: speech in, language model in the middle, speech out, with a transcript
and a trace for every turn.

The product thesis, inherited from the research brief and unchanged by anything we
have built so far:

> **Build the orchestration/control plane and a provider-abstraction layer. Buy
> everything else until volume justifies otherwise.**

The defensible asset is not a model. It is the router that lets each tenant pick a
different STT, LLM and TTS per stage, the credential vault that holds their keys, the
metering that bills them, and the compliance gate that keeps their campaigns legal.
Models are commodities that get cheaper every quarter; the control plane is what they
cannot replace.

## What exists today

A control-plane **interface**, at `/Users/lappy/code/voice-studio`. Nothing behind it.

| Surface | Route | Purpose |
| --- | --- | --- |
| Agents home | `/agents` | Fleet cost, latency, live traffic; entry point after login |
| Agent builder | `/agents/[agentId]` | Per-stage model router, live latency budget, in-browser test call |
| Live call monitor | `/calls` | Every in-flight call; listen / whisper / take over |
| Call detail | `/calls/[callId]` | Diarized transcript beside the OTel span waterfall |
| Outbound campaign | `/campaigns/[campaignId]` | Funnel, dialed list, India compliance pre-flight gate |
| Architecture map | `/architecture` | The information architecture, clickable |

Stack: Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind v4,
`thinking-orbs`. Server components by default; client components only where there is
genuine interactivity (the monitor, the builder's test panel, the two windowed tables).

Not designed and not built: voice library, knowledge & tools, numbers & SIP, evals,
keys & billing, and the interview module. They hold reserved nav slots that render
inert rather than as dead links.

## System shape

The single most important structural decision — and the one that governs cost — is the
split between two planes that scale on completely different curves.

```
                    ┌──────────────────────────────────────────┐
   operators  ──▶   │  CONTROL PLANE          stateless        │
   tenants          │  ─────────────          scale-to-near-0  │
                    │  tenant + agent config                   │
                    │  provider router / BYO-key vault         │
                    │  metering, billing, compliance gate      │
                    │  the UI in this repo                     │
                    └───────────────┬──────────────────────────┘
                                    │  config reads, no per-turn traffic
                    ┌───────────────▼──────────────────────────┐
   PSTN caller ─▶   │  MEDIA PLANE            stateful         │
   (via UL-VNO)     │  ───────────            GPU + concurrency│
                    │  VAD → STT → LLM → TTS loop              │
                    │  barge-in state machine, call state      │
                    │  must stay in-country (India rules)      │
                    └───────────────┬──────────────────────────┘
                                    │  OTel spans, transcripts
                    ┌───────────────▼──────────────────────────┐
                    │  ClickHouse + S3 + Langfuse              │
                    └──────────────────────────────────────────┘
```

**The control plane is cheap and the media plane is not.** Control plane is stateless
HTTP that autoscales and idles at almost nothing. Media plane holds a live WebSocket
and a slice of GPU for the entire duration of every call, and its cost is a direct
function of concurrent sessions. Every cost decision in document 03 is really a
decision about how much work we can move off the media plane, or how well we can keep
its utilisation high.

The corollary matters for engineering discipline: **no per-turn traffic may pass
through the control plane.** If the control plane sits in the audio path, we have
turned a stateless tier into a stateful one and lost both the cost profile and the
latency budget.

## Pipeline model

Cascaded — VAD → STT → LLM → TTS — not native speech-to-speech, as the default.

Native S2S (OpenAI Realtime, Gemini Live, Nova Sonic) is genuinely lower latency, but
it takes the whole agent as one vendor's system with nothing to swap, and it produces
fewer transcripts. For a *resellable* product where each tenant wants different models
and every call needs a transcript for DPDP audit, cascaded is correct. We reserve
native S2S for premium tenants who want the floor on latency and do not need swappable
models.

The latency budget is the thing the builder surface exists to make visible:

| Stage | Budget | Current model in fixtures |
| --- | --- | --- |
| VAD + turn detection | 42 ms | Silero v5 + Smart Turn v2 |
| STT | 208 ms | Sarvam Saaras v3 |
| LLM (TTFT) | 168 ms | GPT-4o-mini, reasoning off |
| TTS (TTFA) | 74 ms | Sarvam Bulbul v3 |
| Transport / playback | 31 ms | Exotel UL-VNO |
| **Voice-to-voice** | **523 ms P50 / 780 ms P95** | target 800 ms |

## The binding constraint

It is not the models, and it is not the engineering. It is Indian telecom regulation.

Domestic VoIP-to-PSTN dial-out is prohibited except through a licensed operator, so a
self-hosted SIP stack **cannot lawfully place Indian phone calls on its own** — we must
sit behind a UL-VNO carrier (Exotel, Ozonetel, Plivo, Knowlarity) permanently, at any
volume. Outbound calling additionally requires DLT principal-entity registration, a
registered telemarketer binding, DND scrubbing before every campaign, and the correct
number series. Call media must stay in-country.

This is why the compliance gate is a pre-flight blocker on the campaign screen rather
than a settings page. See document 05.

## Where the code is honest about the future

Two seams were built deliberately so the backend can land without a rewrite:

- **`src/lib/data/callStore.ts`** exposes `countCalls(filter)` and
  `sliceCalls(offset, limit, filter)` — the exact shape a server-side windowed API
  would have. Replacing the generator with fetches is a one-file change and nothing
  above it knows.
- **`src/lib/fleet.tsx`** is the single source of truth for fleet size and pool
  capacity across the ops shell, so the nav meter and the monitor's capacity stepper
  cannot disagree. They did disagree in the first draft; that class of bug is what
  makes an operator stop trusting a dashboard mid-incident.
