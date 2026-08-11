# 03 — Cost & scaling

How we serve growing volume without the bill growing with it.

> Unit prices marked *[brief]* come from the research brief (August 2026) and move
> monthly. Re-quote before committing any of them to a budget. The brief's own warning
> stands: **advertised voice-agent per-minute prices run 2–3× optimistic all-in.**
> Plan against the loaded column, not the headline.

---

## 1. The one-line answer

Three levers, in descending order of impact:

1. **Push model cost onto the tenant** (BYO keys). Removes 60–80% of variable cost from
   our P&L at a stroke, and costs one vault to build.
2. **Self-host the cheap, small models once volume clears their fixed cost** — TTS
   first, then STT. Both crossovers arrive far earlier than the LLM's.
3. **Keep GPU utilisation above 60%.** Below that, on-demand API is cheaper than
   hardware we are paying for idle. This is the number that decides everything else.

What we do *not* do: self-host the LLM. See §5.

---

## 2. Unit economics

Per call-minute. Assumes the agent speaks roughly half the call, so TTS bills on ~50%
of wall time while STT bills on close to all of it.

| Component | Fully API | Hybrid | Self-hosted |
| --- | --- | --- | --- |
| STT | $0.0077 *[brief]* | $0.0077 | ~$0.001 (amortised GPU) |
| LLM | $0.020–0.150 *[brief]* | $0.015 (4o-mini, reasoning off, cached prompt) | $0.004 |
| TTS | $0.0150 *[brief]* | ~$0.002 (Kokoro self-hosted) | ~$0.001 |
| Telephony (India) | $0.0072 (₹0.60 @ ₹84/$) *[brief]* | $0.0072 | $0.0072 |
| **Headline total** | **$0.050–0.180** | **$0.032** | **$0.013** |
| **Plan against (2×)** | **$0.100–0.360** | **$0.064** | **$0.026** |

Monthly variable spend, excluding GPU fixed cost:

| Volume | Fully API | Hybrid | Self-hosted |
| --- | --- | --- | --- |
| 10k min/mo | $799 | $319 | $132 |
| 100k min/mo | $7,990 | $3,190 | $1,320 |
| 1M min/mo | $79,900 | $31,900 | $13,200 |

At 1M minutes/month the difference between buying everything and running the small
models ourselves is roughly **$67k/month** — about eight engineer-months a year. That
is the prize, and §3 says when to reach for it.

---

## 3. When to self-host: the crossover math

A GPU is a fixed monthly cost; an API is variable. Self-hosting wins past the volume
where fixed beats variable. Both terms are known, so this is arithmetic, not judgement.

GPU fixed cost, 24×7 on-demand (spot or committed-use cuts these 40–70%):

| Instance | $/hr | $/month |
| --- | --- | --- |
| L4 / A10G (24GB) | $0.60 | $438 |
| A100 40GB | $1.10 | $803 |
| H100 PCIe | $2.01 *[brief]* | $1,467 |

Crossover, in audio-hours per month:

| Instance | STT (vs $0.0077/min) | TTS (vs $0.015/call-min) |
| --- | --- | --- |
| L4 / A10G | **948 hrs** | **487 hrs** |
| A100 40GB | 1,738 hrs | 892 hrs |
| H100 PCIe | 3,176 hrs | 1,630 hrs |

The L4 STT figure (948 hrs/mo) reconciles with the brief's stated 500–1,000 audio-hours
crossover, which confirms the model.

### Self-host TTS before STT

**This diverges from the brief**, which calls STT "the first component to self-host."
Our arithmetic says TTS crosses over at roughly **half the volume** — 487 hrs/mo versus
948 on the same L4. Two reasons:

- TTS API pricing is ~2× STT per call-minute even after discounting for the agent only
  speaking half the time.
- Kokoro-82M is 82 million parameters, Apache-2.0, and runs on CPU or 2–4GB of VRAM.
  Whisper large-v3 needs ~10GB and real GPU. The cheap model to displace is also the
  cheap model to host.

Kokoro is therefore the first thing we bring in-house, and it may not need a GPU at all.

**Caveat on the assumption:** the 50% agent-speech ratio drives this. Collections calls
where the agent monologues push TTS higher and strengthen the case; heavily
interruptive support calls weaken it. Measure the real ratio on our own traffic before
the Stage-1 commitment — it is a single query against the transcripts we already store.

---

## 4. Volume tiers

| Monthly minutes | Topology | Rationale |
| --- | --- | --- |
| < 50k | Fully API | Below every crossover. Hardware is dead weight. |
| 50k–500k | Hybrid: self-host TTS, then STT | Both crossovers cleared; LLM still bought |
| > 500k | Self-host STT + TTS, negotiate carrier | Direct SIP at >2M min/mo cuts aggregator margin |
| — | Self-host LLM | Only per §5. Probably never. |

---

## 5. Why we do not self-host the LLM

It is the largest line item, which makes it the tempting one. The threshold is
brutal: it pays off only above **~$200k/month of inference spend AND sustained >60% GPU
utilisation** *[brief]*. Below 60% util, API is simply cheaper.

$200k/month at hybrid LLM pricing is roughly 13M call-minutes/month. We are several
orders of magnitude away, and by the time we are not, hosted model prices will have
fallen again.

The cheap LLM levers that actually apply now, in order:

1. **Small models.** GPT-4o-mini and Claude Haiku are 5–10× cheaper than frontier
   models and sufficient for scripted collections and triage. Already the default.
2. **`reasoning_effort: none`.** Reasoning tokens are pure cost and pure latency in a
   voice loop. Already set.
3. **Prompt caching.** System prompts are long, static and re-sent every turn; cached
   input runs up to ~99% cheaper *[brief]*. The builder shows "1,284 tok · cached" for
   a reason — this is the highest-leverage change per line of code in the whole stack.
4. **Shorter system prompts.** Every token is billed on every turn of every call.

---

## 6. Keeping the media plane efficient

The media plane holds a WebSocket and a GPU slice for the entire call, so its cost is
concurrency × duration. Utilisation is the whole game.

- **Autoscale on active WebSocket connections, not CPU.** A voice session is mostly
  waiting on I/O; CPU-based autoscaling will under-provision and drop calls.
- **Warm pools, no scale-to-zero for realtime.** A cold start inside the 800 ms budget
  is not recoverable. Scale to zero only for batch work.
- **Hard connection caps per node**, to protect downstream STT/TTS from a thundering
  herd. Reject at the edge, do not degrade everyone.
- **Ping/pong heartbeats** to reclaim hung sessions — a leaked session bills like a live
  one.
- **Right-size the model to the language.** Parakeet-TDT is ~4GB VRAM against Whisper
  large-v3's ~10GB, at comparable WER. Two to three times the sessions per GPU for
  free.
- **Batch off the hot path.** Diarization, PII redaction, summarisation and scoring do
  not belong in the turn loop. Queue them, run them on spot capacity.

**Spot and committed-use.** Realtime inference on pure spot is a bad idea, but a
committed-use baseline plus spot for burst and batch is not, and it is a 40–70%
reduction on the GPU line.

---

## 7. Keeping the control plane near-free

This is where the code that exists already pays off.

- **Static prerendering.** Four of seven routes prerender; only the three
  parameterised routes are server-rendered on demand. Static routes are CDN-served and
  cost effectively nothing.
- **Constant client cost.** Measured: 24 cards / 944 DOM nodes at 1,284 live calls and
  identical at 250,000. Fleet growth does not cost browser memory.
- **The monitor must never poll the database.** This is the expensive mistake waiting
  to be made. 1,284 live calls × N operators × a 1s poll is a self-inflicted denial of
  service on Postgres. The correct design is one server-side subscription to a
  Redis/NATS stream, fanned out over WebSocket or SSE, with the **server** doing the
  windowing. `countCalls`/`sliceCalls` are already that shape — keep them.
- **Sample traces.** Full OTel spans on every turn of every call is a large ClickHouse
  bill. Sample healthy calls at 1–5%; keep 100% of calls that breached the latency
  budget, failed a tool call, or ended badly. Those are the only ones anyone reads.
- **Tier the recordings.** S3 Standard for the first 30 days, Glacier Instant for the
  remaining 150 of the 180-day retention. Roughly 60% off storage for a class change.

---

## 8. What we would watch

| Metric | Why it matters | Act when |
| --- | --- | --- |
| GPU utilisation | Decides self-host vs API for everything | Sustained < 50% → shrink pool; > 80% → add |
| Cost per minute, by tenant | Detects tenants on expensive routing | Any tenant > 2× blended |
| Agent-speech ratio | Drives the TTS crossover in §3 | Before Stage-1 commitment |
| Cache hit rate on prompts | Largest LLM lever | < 80% → the prompt is churning |
| P95 voice-to-voice | Product quality; also detects thrash | > 800 ms sustained |
| Concurrency vs pool | Capacity headroom | > 75% → scale up before queuing |

The last one is already wired into the UI: pool utilisation goes amber at 75% and red
at 90%, so the operator scales up *before* calls queue rather than after.
