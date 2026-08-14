import type { ReactNode } from 'react'

/** Section eyebrow — the small mono all-caps label used throughout. */
export function Eyebrow({
  children,
  tone = 'paper',
  className = '',
}: {
  children: ReactNode
  tone?: 'paper' | 'ops'
  className?: string
}) {
  return (
    <div
      className={`font-mono text-[9.5px] leading-none font-semibold tracking-[0.07em] ${
        tone === 'ops' ? 'text-ops-muted-3' : 'text-muted-4'
      } ${className}`}
    >
      {children}
    </div>
  )
}

type ButtonVariant = 'primary' | 'ghost' | 'dark' | 'ops' | 'ops-primary'

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white shadow-[0_1px_2px_rgba(0,0,0,.12)]',
  ghost: 'border border-[#ddd7ce] bg-panel text-ink-2 hover:bg-panel-2',
  dark: 'bg-ink text-white',
  ops: 'border border-ops-line text-ops-ink-3 hover:bg-ops-raised',
  'ops-primary': 'bg-accent text-ops-bg',
}

export function Button({
  children,
  variant = 'ghost',
  className = '',
  ...rest
}: {
  children: ReactNode
  variant?: ButtonVariant
  className?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`rounded-[6px] px-[13px] py-[8px] font-sans text-[12px] leading-none font-semibold transition-colors ${BUTTON_STYLES[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

/** Small outlined mono pill — model names, flags, knobs. */
export function Chip({
  children,
  tone = 'fill',
  className = '',
}: {
  children: ReactNode
  tone?: 'fill' | 'outline' | 'accent' | 'ops-fill' | 'ops-outline' | 'ops-alert' | 'ops-good'
  className?: string
}) {
  const styles: Record<string, string> = {
    fill: 'bg-line-5 text-ink-3',
    outline: 'border border-line text-muted-3',
    accent: 'border border-accent-line bg-accent-tint text-accent-deep',
    'ops-fill': 'bg-ops-raised text-ops-ink-3',
    'ops-outline': 'border border-ops-line text-ops-muted-2',
    'ops-alert': 'bg-accent font-semibold text-ops-bg',
    'ops-good': 'border border-ops-good-line bg-ops-good-bg text-ops-good-2',
  }
  return (
    <span
      className={`inline-block rounded-[4px] px-[6px] py-[3px] font-mono text-[10px] leading-none font-medium ${styles[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

/** Horizontal meter with an optional target tick. */
export function Meter({
  pct,
  color = 'var(--color-accent)',
  track = 'var(--color-line-4)',
  height = 4,
  targetPct,
  targetColor = 'var(--color-ink)',
}: {
  pct: number
  color?: string
  track?: string
  height?: number
  targetPct?: number
  targetColor?: string
}) {
  return (
    <div
      className="relative overflow-visible rounded-[2px]"
      style={{ height, background: track }}
    >
      <div
        className="h-full rounded-[2px]"
        style={{ width: `${Math.min(pct, 100)}%`, background: color }}
      />
      {targetPct !== undefined ? (
        <div
          className="absolute top-[-3px] w-px"
          style={{ left: `${targetPct}%`, height: height + 6, background: targetColor }}
        />
      ) : null}
    </div>
  )
}

/** Paper card. */
export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <div
      className={`rounded-[9px] border border-line bg-panel ${padded ? 'p-[14px_15px]' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

/** Labelled text input. Was in the old sign-in form; every studio form uses it. */
export function Field({
  label,
  name,
  type = 'text',
  autoComplete,
  defaultValue,
}: {
  label: string
  name: string
  type?: string
  autoComplete?: string
  defaultValue?: string
}) {
  return (
    <label className="flex flex-col gap-[7px]">
      <span className="font-mono text-[10px] font-semibold tracking-[0.07em] text-muted-4">
        {label.toUpperCase()}
      </span>
      <input
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        className="rounded-[7px] border border-line bg-panel px-3 py-[10px] font-sans text-[13px] text-ink outline-none focus:border-accent"
      />
    </label>
  )
}
