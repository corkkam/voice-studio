# Voice Studio

Control plane for a multi-tenant voice-AI platform: build cascaded STT→LLM→TTS agents,
watch them run on Indian PSTN, and audit what they said. Implemented from the
`Voice Studio.dc.html` mockups in the Claude Design project
`a283cb68-4513-40d7-a1cf-e897b9025e18`.

```bash
pnpm install
pnpm dev        # http://localhost:3000 — create a workspace at /signup
pnpm seed       # or: demo tenant, published agent, key pair, live calls
pnpm session    # a vs_session cookie for the seeded user, for scripted checks
pnpm build      # production build
pnpm typecheck
```

`pnpm seed` prints the demo login and a fresh API key pair, and drives its calls through
the public API so the monitor has real traffic. `SEED_CALLS=40 pnpm seed` fills the grid.
Local state is `data/voice-studio.db`; deleting it is the supported reset.

For the architecture, decision log, unit economics and staged plan, see the CTO
briefing pack in [`docs/`](./docs/README.md). Working on the code: read
[`AGENTS.md`](./AGENTS.md) first — it carries the landmines and the repo skills.

## Surfaces

| Route | Mockup | What it is |
| --- | --- | --- |
| `/agents` | 1a | Agents home — fleet cost, latency and live traffic |
| `/agents/[agentId]` | 1b | Agent builder — per-stage model router, live latency budget, in-browser test call |
| `/calls` | 1c | Live call monitor — dark ops view, listen / whisper / take over |
| `/calls/[callId]` | 1d | Call detail — diarized transcript beside the OTel span waterfall |
| `/campaigns/[campaignId]` | 1e | Outbound campaign — India compliance as a pre-flight gate |
| `/architecture` | 2a | The information architecture itself, clickable |

Left nav (Build / Run / Trust) is fixed on every screen, per the IA in 2a. Nav slots
with no screen yet — Voices, Knowledge & tools, Numbers & SIP, Evals, Compliance,
Keys & billing — render as reserved and inert rather than as dead links.

## Orbs instead of waveforms

The mockups drew live agents as animated bar waveforms. A waveform only ever says
"audio is moving" — it cannot distinguish the caller talking from the agent talking
from a tool call stalling, which is precisely what an operator scanning a thousand
concurrent calls needs. Those are now [`thinking-orbs`](https://www.npmjs.com/package/thinking-orbs)
(MIT, no dependencies), one orb state per pipeline stage:

| Activity | Orb state | Why that animation |
| --- | --- | --- |
| Caller speaking | `listening` | a waveform rolling through the rings |
| LLM generating | `working` | particles working tilted orbits |
| TTS streaming out | `composing` | an undulating multi-band sash |
| Knowledge lookup | `searching` | a scan meridian sweeping the globe |
| Tool call in flight | `solving` | bands scramble, then click back solved |
| Dialing / call setup | `connecting` | a constellation wiring itself |
| Warm transfer | `weaving` | three strands plaiting — two legs bridged |
| Provider failover | `shaping` | the outline re-forming into a new shape |
| Holding / queued | `breathing` | a ring slowly morphing |

All nine shipped states are used, and the mapping lives in one place —
`src/lib/activity.ts`. The orbs stay monochrome (the library's design: light ink on
dark substrates, dark on light, resolved from the `data-theme` each shell sets), so
the studio's orange stays reserved for numbers that breached a budget.

Two waveforms survive on purpose, because they are audio rather than agents: the
recording scrubber on call detail, and the disclosure-clip preview in the compliance
gate.

> The package on npm is published from `Jakubantalik/thinking-orbs`; the requested
> `corkkam/thinking-orbs` describes the same nine states and API.

## Scale

The monitor is built so a busy hour cannot take the tab down.

- **Nothing off-viewport is materialised.** Live sessions come from SQLite; the
  monitor subscribes over SSE. `src/lib/useVirtualGrid.ts` still windows the grid
  to the visible rows plus a small overscan, so render cost tracks the viewport.
- **Orb budget.** Each orb is a real 2D-canvas animation. The library already pauses
  offscreen instances; above `LIVE_ORB_BUDGET` cards *on* screen the orbs render a
  static frame, so a 4K wallboard degrades to stillness rather than to jank. State is
  still legible — it just stops moving.
- **Responsive, not fixed.** Columns are derived from the measured container width via
  `ResizeObserver`, so the grid reflows from a 13" laptop to an ultrawide with no
  per-screen breakpoints. Side rails drop below the main column under `xl`.
- **Filters narrow the set, not the render.** Counts are computed with a capped scan
  and reported as an estimate past the cap, so filtering never walks a six-figure fleet
  on every keystroke.
- **Capacity is a control, not a readout.** `src/lib/fleet.tsx` holds pool size for the
  whole ops shell — the nav meter and the monitor's ± stepper read the same number, and
  utilisation goes amber before red so you scale up before calls queue.

The campaign table is windowed the same way once a licensed dialer fills it.

## Auth, data, and connecting agents

The studio is no longer fixture-driven. Sign up creates a tenant. Agents, keys, calls
and campaigns live in SQLite at `data/voice-studio.db`. The live monitor subscribes
over SSE to real sessions.

Clients (web apps, the embeddable widget, Mac apps) open a session with an API key:

```bash
curl -X POST http://localhost:3000/api/v1/sessions \
  -H "Authorization: Bearer vs_sk_live_…" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"agt_…","channel":"web"}'
```

- Browser script: `/sdk/voice-studio.js` (`VoiceStudio.mount` / `new VoiceStudio`)
- TypeScript client: `sdk/js/index.ts`
- Swift Package: `sdk/swift` (`VoiceStudioClient`)
- Widget preview: `/widget/[agentId]`

Turn audio stays on the device (Web Speech / AVSpeech). The control plane records the
session and completes the LLM turn at `/api/media/complete`. Set `XAI_API_KEY` for a
live model; otherwise sessions still connect and return a fallback reply.

Reserved nav slots without screens yet — Voices, Knowledge & tools, Numbers & SIP,
Evals, Compliance — stay inert. **Keys** is a real page.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 · thinking-orbs.
Design tokens — the two palettes, paper and ops — are defined once in
`src/app/globals.css` under `@theme`.

## Scope

Telephony and a licensed Indian carrier are still unbuilt — PSTN numbers will not
dial. The India regulatory content in the campaign gate is engineering guidance, not
legal advice.
