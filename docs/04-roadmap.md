# 04 — Roadmap

Four stages with explicit gates. Nothing in a later stage starts until its gate is met
— the gates exist to stop us buying hardware or building abstractions before volume
justifies them.

Effort is indicative and assumes a small team (2–4 engineers). Dates deliberately
omitted; the gates, not the calendar, decide.

---

## Stage 0 — Make one real call end to end

**Goal.** Replace the fixture layer with a single live call. Not a product — proof the
seams are right.

| Work | Notes |
| --- | --- |
| Media plane service | Pipecat or LiveKit Agents; one cascaded pipeline, hardcoded models |
| Carrier integration | Exotel or Plivo UL-VNO, one DID, inbound only |
| Real data behind `callStore` | Swap the generator for the API; the accessor shape does not change |
| Live call stream | Redis/NATS → WebSocket fan-out; server-side windowing |
| Postgres schema | Tenants, agents, agent versions, calls, transcripts |
| Auth + one tenant | Real login; multi-tenancy stubbed but modelled |

**Deliberately not yet:** provider router, BYO keys, evals, campaigns, billing.

**Gate to Stage 1:** one inbound call answered by an agent, transcript stored, spans
visible in the existing call-detail UI, voice-to-voice P95 under 1.2s.

---

## Stage 1 — Multi-tenant MVP, buy everything

**Goal.** The product from the brief's Stage 0 recommendation. Sellable to design
partners.

| Work | Notes |
| --- | --- |
| **Provider router** | The core IP. Per-stage, per-tenant model selection with failover |
| **BYO-key vault** | KMS-encrypted per tenant. Highest-margin item in the plan — see doc 03 §1 |
| Outbound campaigns | Dialer, pacing, retry, AMD |
| **Compliance gate** | DLT PE, RTM binding, number series, DND scrub, consent expiry. Blocking |
| Metering + billing | Per-minute, per-tenant, per-stage attribution |
| OTel instrumentation | `invoke_agent` parent, child span per stage, into ClickHouse + Langfuse |
| Agent versioning + publish | Publish as the only write that changes live traffic |
| The unbuilt surfaces | Voice library, numbers & SIP, keys & billing |

**Models bought, not hosted:** Deepgram/Sarvam STT, hosted LLM, Cartesia/Sarvam TTS.
Per doc 03, everything is below crossover at this volume.

**Gate to Stage 2:** >50k voice-minutes/month sustained, or model spend becoming a
visible fraction of gross margin.

---

## Stage 2 — Hybrid: bring the cheap models in-house

**Goal.** Cut variable cost roughly in half without touching the LLM.

| Work | Order matters |
| --- | --- |
| **1. Measure the agent-speech ratio** | One query. Confirms or kills the TTS-first call in doc 03 §3 |
| **2. Self-host Kokoro TTS** | Earliest crossover (~487 hrs/mo on an L4). May not need a GPU |
| **3. Self-host Parakeet/faster-whisper STT** | ~948 hrs/mo. Parakeet over Whisper — 4GB vs 10GB VRAM |
| 4. Keep APIs as router failover | Self-hosted primary, API fallback. The router already models this |
| 5. GPU autoscaling | On active WebSocket count, warm pools, hard connection caps |
| 6. Semantic turn detection | Smart Turn v2 / Krisp VIVA; noise cancellation *before* VAD |
| 7. Eval harness | Regression suite gating publish on v2v and task success |
| 8. Prompt caching + trace sampling | Doc 03 §5 and §7. Cheap, large |

**Gate to Stage 3:** >500k voice-minutes/month **and** sustained GPU utilisation above
60%. Both, not either — hardware below 60% util is more expensive than the API it
replaced.

---

## Stage 3 — Scale and margin

| Work | Notes |
| --- | --- |
| Direct carrier SIP | Jio/Airtel/Tata at >2M min/mo, cutting aggregator margin. Still licensed |
| Regional GPU pools | Data residency; India media stays in-country regardless |
| Committed-use + spot mix | 40–70% off the GPU line (doc 03 §6) |
| SOC 2 Type II | Enterprise gate, not a technical one |
| Native S2S for premium tenants | Topology toggle already in the builder UI |
| Self-hosted LLM | **Only** above ~$200k/mo inference spend at >60% util. Probably never |

---

## Deferred, and why

**AI interview module.** Architecturally it is the same voice pipeline plus a video
layer and a rubric, so it looks cheap. It is not: hiring AI is EU AI Act Annex III
high-risk, NYC Local Law 144 demands an independent bias audit, and Illinois AIVIA
requires notice and consent. Article 5(1)(f) bans emotion inference in employment
outright. It needs jurisdiction-aware consent and audit gating built in from the first
line, so it ships as a **separate regulated module**, never as a checkbox on a normal
agent. See doc 05.

**Meeting-bot joining.** Buy Recall.ai at $0.50/hr *[brief]* when a customer asks. DIY
headless-browser bots only make sense at volume, and they carry bot-detection and legal
review we do not want to own yet.

**Voice cloning.** Needs specific speaker consent under DPDP, and several of the
best-sounding open models are not commercially licensable (XTTS-v2 is CPML, F5-TTS is
CC-BY-NC, Fish Audio requires a paid licence). Any model we ship must clear a licence
audit first — for a resellable product, licensing is the binding filter, not quality.

---

## Standing engineering rules

Carried forward from doc 02, restated because they are easy to erode:

1. No per-turn traffic through the control plane.
2. The monitor never polls the database — it subscribes to a stream.
3. Publish is the only write that changes live traffic.
4. Every model gets a licence audit before it ships.
5. Windowing, not pagination, on any list that can exceed a screen.
6. One source of truth per number that appears in more than one place.
