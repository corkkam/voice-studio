# 05 — Risks & compliance

> Engineering guidance, not legal advice. Obtain Indian telecom and employment counsel
> before production. Regulatory content is reproduced from the research brief (August
> 2026) and its own caveat applies: the domestic VoIP→PSTN position rests on the
> pre-Telecom-Act-2023 licence framework, and DoT's final service-authorisation rules
> were still pending as of early 2026.

---

## Why this document exists

For most SaaS, compliance is a tax paid before an enterprise deal closes. Here it is
the **architecture**. Two of the constraints below are the reason the system is shaped
the way document 01 describes, and getting them wrong does not produce a fine — it
produces blacklisted numbers and a dead campaign.

---

## Tier 1 — Existential

### 1.1 We cannot be the carrier

Only UASL / CMTS / Unified Licence (Access Service) holders may interconnect internet
telephony with the PSTN. ISP licence terms explicitly bar PSTN/PLMN connectivity and
E.164↔IP translation. The rationale is toll bypass.

**Consequence.** A self-hosted SIP/WebRTC stack is lawful for media, but cannot
originate or terminate Indian phone calls on its own. We sit behind a UL-VNO carrier
(Exotel, Ozonetel, Plivo, Knowlarity) permanently, at every volume. At >2M min/month we
negotiate direct Jio/Airtel/Tata SIP — still a licensed carrier.

**Risk if wrong.** Unlicensed operation. Not a fine — an existence question.

### 1.2 Media must stay in-country

Indian voice rules require call media to remain in India.

**Consequence.** The media plane is regionally pinned. GPU pools in `ap-south-1` or
equivalent; no failover to a cheaper region during a capacity crunch, however tempting
the autoscaler makes it. Recordings in `ap-south-1` S3.

**Design implication.** Cross-region failover is not a lever available to us for
Indian traffic. Capacity planning has to be regional.

### 1.3 Outbound requires DLT registration and an RTM binding

Every business must register as a **Principal Entity** on the blockchain DLT platform,
and calls must be placed via a **Registered Telemarketer** with an active PE↔TM
binding. Scripts and templates are pre-registered.

Indicative costs *[brief]*: one-time entity registration ~₹5,900 + GST; refundable TM
security deposit ₹50,000; TM registration valid 5 years.

**Consequence.** The compliance gate blocks the dialer, and the script diff against the
approved template must be zero. This is why the campaign surface shows
"script diff vs approved: 0" as a gate line rather than a log entry.

---

## Tier 2 — Operational

### 2.1 Number series

| Series | Use |
| --- | --- |
| `140xxxxxxx` | Promotional / telemarketing |
| `1600xxxxxxx` | Service / transactional for BFSI |
| `1601xxxxxxx` | RBI / SEBI / IRDAI / PFRDA-regulated entities |

Migration to the 1600 series was phased through Q1 2026 by entity class *[brief]*.
Sources use "160" and "1600" interchangeably; the official December 2025 release says
"1600".

**Consequence.** Series is a per-campaign property validated by the gate, not a tenant
setting. A service campaign routed over a promotional number is a violation.

### 2.2 DND / NCPR scrubbing

No promotional call to a DND-registered number without explicit consent. The registry
refreshes daily and must be scrubbed **before every campaign**. An enquiry within 90
days counts as implied consent for related service calls.

**Consequence.** The gate re-validates every 30 minutes, and the scrub timestamp is
shown ("registry pulled 1h 12m ago") because a stale scrub is indistinguishable from no
scrub at the point of dialing.

### 2.3 Consent expires in 7 days

The February 2025 second amendment to TCCCPR capped explicit-consent validity at **7
days** for commercial transactions, and lowered the complaint trigger from 10 to 5.

**Consequence.** Consent is a decaying asset with a job that re-collects it. The gate
surfaces "412 records hit the 7-day cap in 36 h" as a warning state — the campaign
keeps running, but the operator has a countdown.

### 2.4 Algorithmic spam flagging

TRAI's third amendment pushed AI/ML spam detection. A 10-digit number placing ~800
short calls/day gets flagged within days *[brief]*.

**Consequence.** Number rotation is a capacity primitive, not an optimisation. The
campaign surface tracks short-calls-per-number-per-day against the ~800 threshold and
shows the rotation pool. Getting this wrong burns numbers, and numbers require KYC to
replace.

### 2.5 DPDP Act

Rules notified 13 November 2025. Consent Manager framework from **13 November 2026**;
substantive obligations fully enforceable around **13 May 2027** *[brief]*.

Voice recording is processing personal data: explicit, purpose-specific, informed
consent plus a Section 5 itemised notice in English and Eighth-Schedule languages. AI
and recording must be disclosed at call start. Voice cloning needs specific speaker
consent.

Schedule-1 maximum penalty is **₹250 crore** for failure to implement reasonable
security safeguards.

**Consequence.** The disclosure line is the agent's first utterance, in the caller's
language, and it is a gate check with audio preview rather than a prompt instruction
that might drift. The transcript records the disclosure and the retention notice as
compliance affirmations on the turns themselves.

**Timeline note.** May 2027 is closer than it reads for a platform storing voice.
Retention, deletion-on-request and consent records are Stage-1 work, not Stage-3.

---

## Tier 3 — Market-specific

### 3.1 United States (TCPA)

All AI and cloned voices count as "artificial or prerecorded": prior express written
consent for marketing, AI disclosure at call start, opt-outs honoured within 10
business days, STIR/SHAKEN A-level attestation or carriers block the traffic. Penalties
$500–$1,500 per call, uncapped *[brief]*.

**Uncapped per-call penalties on an autodialer is the worst risk shape in this
document.** A misconfigured campaign scales the liability linearly with our own
throughput.

### 3.2 EU

AI Act Article 50 transparency, GDPR consent, and two-party-consent recording rules in
some jurisdictions.

### 3.3 Hiring AI — deferred deliberately

If the interview module ships, it is high-risk regulated:

- **EU AI Act** Annex III: risk management, data governance, human oversight,
  conformity assessment before market. **Article 5(1)(f) bans emotion inference in
  workplace and education outright.**
- **NYC Local Law 144:** independent bias audit within 12 months, public disclosure,
  candidate notice. Liability sits with the employer — our customer — which makes it a
  sales problem as well as a legal one.
- **Illinois AIVIA / HB 3773:** notice and written consent, deletion within 30 days on
  request, demographic reporting.
- **Title VII / EEOC:** adverse-impact analysis regardless of any audit.

**Consequence.** Jurisdiction-aware consent and audit gating from the first line, and
no EU emotion inference ever. Hence a separate module, per doc 04.

---

## Technical risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| **Model licence contamination** | A non-commercial model in a resellable product | Licence audit before any model ships. XTTS-v2 (CPML), F5-TTS (CC-BY-NC), Fish Audio (paid) are all **not** commercial-safe. Canary/Parakeet are CC-BY-4.0 — attribution required |
| **Prompt injection via transcribed speech** | Caller speech reaches a tool-calling LLM | Treat transcribed speech as untrusted input. Whitelist tool args, sandbox side-effects. `send_payment_link` is marked "args whitelisted" for this reason |
| **Monitor polls the database** | Self-inflicted DoS at scale | Stream + server-side windowing. Doc 03 §7 |
| **Provider degradation mid-call** | Dead air, failed calls | Router failover across providers. Already modelled in the UI's failover state |
| **Cross-tenant data leakage** | Existential for a multi-tenant product | Per-tenant encryption keys, row-level isolation, per-tenant credential vaulting |
| **GPU under-utilisation** | Hardware costs more than the API it replaced | Gate self-hosting on >60% sustained util. Doc 03 §3 |
| **Vendor price moves** | Margin erosion on bought models | BYO keys shift exposure to the tenant. Doc 03 §1 |

---

## What is not covered

- Recording consent in two-party-consent US states.
- Sector rules (RBI collections conduct, IRDAI insurance calling) beyond the number
  series.
- Cross-border transfer for tenants operating outside India.
- Contractual liability allocation between us and tenants for their campaigns —
  a commercial question, and an urgent one given §3.1.
