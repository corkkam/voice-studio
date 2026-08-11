# 02 — Decisions

Every non-obvious call made so far, why, and what would reverse it. Decisions 1–5 are
product/architecture and outlive the current code. Decisions 6–14 are implementation.

---

## 1. Cascaded pipeline as the default, native S2S as a premium option

**Why.** Per-stage model routing is the product. A tenant who wants Sarvam for Hindi
and Deepgram for English cannot be served by a single vendor's end-to-end model.
Cascaded also produces a transcript per turn, which DPDP audit and the eval loop both
require, and it lets us tune each stage against the 800 ms budget independently.

**Cost.** Roughly 100–200 ms more voice-to-voice latency than native S2S, and a more
complex barge-in state machine we own rather than inherit.

**Reverses if.** A tenant segment materialises that values sub-500 ms latency over
model choice and does not need transcripts. Then native S2S ships as a topology toggle
— the builder UI already has the toggle rendered, unwired.

---

## 2. Buy the carrier, permanently

**Why.** Not an economic choice. Indian licence terms bar anyone but a licensed
operator from interconnecting internet telephony with the PSTN. A self-hosted
Asterisk/LiveKit stack is lawful for the media path but cannot originate or terminate
Indian phone calls on its own.

**Reverses if.** Never, at our scale. At >2M minutes/month we negotiate direct
Jio/Airtel/Tata SIP to cut the aggregator margin, but that is still a licensed carrier
— it changes the price, not the architecture.

---

## 3. Control plane and media plane scale separately

**Why.** They have opposite cost curves: stateless request/response that idles at zero,
versus stateful sessions holding GPU for the length of a call. Fusing them means paying
media-plane prices for control-plane work.

**Enforcement.** No per-turn traffic through the control plane, ever. This is a review
rule, not a preference.

---

## 4. BYO API keys, per tenant, from day one

**Why.** It is the single largest margin lever available at MVP, and it costs almost
nothing to build early versus retrofitting later. When a tenant supplies their own
Deepgram and OpenAI keys, their model spend never touches our P&L — we charge a
platform fee on a cost base that is close to zero and our gross margin stops being a
function of token prices we do not control.

**Cost.** A credential vault (KMS-encrypted, per-tenant) and per-provider failover
logic that has to work with keys we cannot inspect or top up.

**Reverses if.** Never fully — but we will need a pooled-key path too, because
self-serve tenants will not want to bring keys. Expect both, with BYO as the
enterprise default.

---

## 5. Compliance is a pre-flight gate, not a settings page

**Why.** DLT registration, RTM binding, number series, DND scrub and consent validity
are not preferences — a campaign that starts without them gets the tenant's numbers
blacklisted. Checks belong at the point of the decision, blocking the dialer, and
they re-validate every 30 minutes because DND registries refresh daily and explicit
consent expires in 7 days.

**Consequence.** "Start campaign" is a gated action with a failure state that must be
designed, not a button. That is why the campaign surface gives the gate a permanent
rail rather than a modal.

---

## 6. Orbs replace the agent-activity waveforms

**Why.** The mockups drew live agents as animated bar waveforms. A waveform only ever
communicates "audio is moving" — it cannot separate the caller talking from the agent
talking from a tool call hanging, which is precisely the distinction an operator
scanning a thousand concurrent calls needs. `thinking-orbs` ships nine hand-tuned
states, so we mapped one per pipeline stage and the animation now carries the
diagnosis.

| Activity | Orb state | Activity | Orb state |
| --- | --- | --- | --- |
| Caller speaking | `listening` | Dialing / setup | `connecting` |
| LLM generating | `working` | Warm transfer | `weaving` |
| TTS streaming | `composing` | Provider failover | `shaping` |
| Knowledge lookup | `searching` | Holding / queued | `breathing` |
| Tool call in flight | `solving` | | |

All nine states are used. The mapping is centralised in `src/lib/activity.ts`; nothing
else in the codebase names an orb state.

**Kept as waveforms on purpose:** the recording scrubber on call detail and the
disclosure-clip preview in the compliance gate. Both are audio, not agents — the
scrubber is a seek surface.

**Note.** The library is MIT with no dependencies. npm publishes it from
`Jakubantalik/thinking-orbs`; the `corkkam` fork named in the original request
describes the same nine states and API.

---

## 7. Orbs stay monochrome

**Why.** The library's design is strictly monochrome — light ink on dark substrates,
dark on light, resolved from the nearest `data-theme` ancestor. Tinting them to the
brand orange would put a permanently-moving orange object on every card, competing for
attention with the only thing orange is supposed to mean here: a number that breached
its budget.

---

## 8. Window everything; never paginate

**Why.** A monitor with a "next page" button is useless during an incident — the
operator does not know which page the problem is on. Windowing gives unbounded scroll
at constant render cost, which is strictly better for this use case.

**Measured.** 24 cards / 24 canvases / 944 DOM nodes at 1,284 live calls, and identical
at 250,000. Client cost tracks the viewport, not the fleet.

**Consequence.** Row heights are fixed and card content clips. That is the price of
simple windowing math, and it is worth paying.

---

## 9. Orb budget: degrade to stillness, never to jank

**Why.** Each orb is a real 2D-canvas animation. The library already pauses offscreen
instances, but a 4K wallboard can legitimately hold 40+ cards *on* screen, and forty
simultaneous animations communicate nothing extra. Above `LIVE_ORB_BUDGET` (24) visible
cards, orbs render a static frame — state stays legible, motion stops.

---

## 10. Data generated lazily per index, behind an API-shaped boundary

**Why.** Fixtures that are arrays cap at their length and teach the UI bad habits.
`callAt(i)` synthesises a call from a deterministic seed, so memory is O(visible) and
the fleet size is a constant we can raise by three orders of magnitude to load-test
without allocating anything. The accessors are named and shaped like the real API
(`countCalls`, `sliceCalls`) so the swap is one file.

**Deliberate limit.** Filter counts scan a capped 4,000 calls and extrapolate past
that, rather than walking a six-figure fleet on every keystroke.

---

## 11. Two palettes, not light/dark variants of one

**Why.** The build surfaces are always paper and the ops surfaces are always dark. That
is a product decision from the mockups — an operator watching calls at 2am gets the
dark room regardless of their OS preference — so they are two palettes defined side by
side in `@theme`, not a theme toggle. Each shell stamps `data-theme`, which is also
what the orbs read to pick their ink.

---

## 12. Left nav on every screen

**Why.** The mockups disagreed with themselves: the IA turn states "left nav is fixed
on every screen", while the drill-down screens (builder, call detail, campaign) render
without it. We followed the IA turn — it is the later of the two, and screens that drop
navigation strand the user.

---

## 13. Reserved nav slots render inert, not as dead links

**Why.** Six sections have entry points in the IA but no screens. Hiding them
misrepresents the product's shape; linking them to 404s is worse. They render greyed
with a title attribute explaining why.

---

## 14. Next.js 16 over the pinned 15.5.4

**Why.** pnpm flagged 15.5.4 as deprecated on install. For a project with no history,
starting on a deprecated minor to save one reinstall is a bad trade.

**Cost.** Next 16 ships an `AGENTS.md` telling agents to read version-matched docs from
`node_modules`. It is regenerated by `next dev`, so it is committed rather than fought.

---

## Reversed during the build

**Fleet size had two sources of truth.** The ops nav read a static `128/240` fixture
while the monitor header read the real fleet count and its own capacity state, so the
two disagreed on screen. Both now read `src/lib/fleet.tsx`. Worth recording because the
failure mode is not cosmetic — a dashboard that contradicts itself during an incident
stops being used.

**The queue tile lost its meaning.** The mockup's "123 more live" tile made sense when
the grid showed five cards. Once every call is scrollable it is nonsense, but the
ratios on it (answered, AMD, DND-skipped) are fleet-level facts that still matter, so
they moved to the ops nav where they are always visible.
