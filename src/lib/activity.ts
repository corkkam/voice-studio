import type { OrbState } from 'thinking-orbs'

/**
 * What a voice agent is doing right now, in the vocabulary of the cascaded
 * VAD → STT → LLM → TTS pipeline.
 *
 * The mockups showed live agents as animated bar waveforms. A waveform only
 * ever says "audio is moving" — it cannot distinguish the caller talking from
 * the agent talking from a tool call stalling, which is exactly what an
 * operator scanning 128 concurrent calls needs to see. Swapping in a thinking
 * orb turns that one channel into two: the orb's *state* names the pipeline
 * stage, and the label underneath spells it out.
 */
export type CallActivity =
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'retrieving'
  | 'tool'
  | 'connecting'
  | 'transferring'
  | 'recovering'
  | 'idle'

export interface ActivityView {
  /** The thinking-orbs animation that stands in for this pipeline stage. */
  orb: OrbState
  /** Operator-facing label rendered beside the orb. */
  label: string
  /** Multiplier on the orb's baked speed — urgency reads as tempo. */
  speed: number
  /** Screen-reader text; overrides the orb's per-state default. */
  aria: string
}

/**
 * Every one of the nine shipped orb states maps to exactly one pipeline stage,
 * chosen so the animation's own metaphor matches what the stage is doing:
 *
 *   listening    caller speaking     a waveform rolling through the rings
 *   working      LLM generating      particles working tilted orbits
 *   composing    TTS streaming out   an undulating multi-band sash
 *   searching    knowledge lookup    a scan meridian sweeping the globe
 *   solving      tool call in flight bands scramble, then click back solved
 *   connecting   dialing / setup     a constellation wiring itself
 *   weaving      warm transfer       three strands plaiting — two legs bridged
 *   shaping      provider failover   the outline re-forming into a new shape
 *   breathing    holding / queued    a ring slowly morphing
 */
export const ACTIVITY: Record<CallActivity, ActivityView> = {
  listening: {
    orb: 'listening',
    label: 'Caller speaking',
    speed: 1,
    aria: 'Caller speaking — capturing audio',
  },
  thinking: {
    orb: 'working',
    label: 'Generating reply',
    speed: 1.15,
    aria: 'Language model generating the reply',
  },
  speaking: {
    orb: 'composing',
    label: 'Agent speaking',
    speed: 1,
    aria: 'Agent speaking — synthesised audio streaming',
  },
  retrieving: {
    orb: 'searching',
    label: 'Knowledge lookup',
    speed: 1,
    aria: 'Searching the knowledge base',
  },
  tool: {
    orb: 'solving',
    label: 'Tool call',
    speed: 1.2,
    aria: 'Tool call in flight',
  },
  connecting: {
    orb: 'connecting',
    label: 'Connecting',
    speed: 1,
    aria: 'Placing the call',
  },
  transferring: {
    orb: 'weaving',
    label: 'Warm transfer',
    speed: 1,
    aria: 'Bridging the caller to a human agent',
  },
  recovering: {
    orb: 'shaping',
    label: 'Failing over',
    speed: 1.35,
    aria: 'Provider degraded — failing over mid-turn',
  },
  idle: {
    orb: 'breathing',
    label: 'Holding',
    speed: 0.85,
    aria: 'Call holding, nothing in flight',
  },
}

/**
 * The turn cycle a healthy call walks, used by the live simulation to advance
 * each card. Tool calls and transfers are injected out of band.
 */
export const TURN_CYCLE: CallActivity[] = ['listening', 'thinking', 'speaking']
