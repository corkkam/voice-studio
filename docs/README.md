# Voice Studio — CTO briefing pack

Six documents, written 12 August 2026. Read in order; each stands alone.

| # | Document | Answers |
| --- | --- | --- |
| 01 | [Overview](./01-overview.md) | What exists today, what it is for, how the system is shaped |
| 02 | [Decisions](./02-decisions.md) | Every non-obvious call made so far, and what would reverse it |
| 03 | [Cost & scaling](./03-cost-and-scaling.md) | Unit economics, the crossover math, how we stay cheap |
| 04 | [Roadmap](./04-roadmap.md) | Staged plan with the gates between stages |
| 05 | [Risks & compliance](./05-risks-and-compliance.md) | India telecom + DPDP, the binding constraint on the business |

## Read this first

**What is built is the interface, not the platform.** `/Users/lappy/code/voice-studio`
is a Next.js control-plane UI covering five surfaces — agent list, agent builder, live
call monitor, call detail, outbound campaign — running entirely on fixture and
generated data. There is no telephony, no model inference, no carrier integration and
no backend behind it. Roughly 4,200 lines across 29 source files.

Everything in documents 03, 04 and 05 is therefore **plan, not status**. Where a number
comes from the source research brief (`uploads/voice-studio.md`, August 2026) rather
than from our own measurement, it is marked *[brief]*. Those figures move monthly and
must be re-quoted before any of them is committed to a budget.

Two numbers in this pack we did measure ourselves, on the code that exists:

- The live monitor holds **24 cards / 944 DOM nodes at 1,284 concurrent calls, and
  identically at 250,000** — client cost is constant in fleet size.
- Four of seven routes prerender static; the other three are server-rendered on demand.
