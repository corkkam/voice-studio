---
name: studio-surface
description: Add or change a Voice Studio screen, layout, component or copy. Use for any UI work on the studio or ops shells, on the live monitor grid, on orb states, on the nav, on design tokens, and for the mocks-before-code step required before non-trivial UI changes.
---

# Build a surface

## Mocks first

For a new screen, a layout change, or a copy rewrite: do not edit real components yet.
Publish distinct mocks with the `html-communication` skill, report the URL, stop, and
implement only the option picked. This is a house rule and it overrides the default
"just do the work".

No mock needed for a wrong label, a spacing fix, a stuck control, or a bug in a
component that already exists.

## Which shell

`src/app/(studio)/layout.tsx` is paper and always light. `src/app/(ops)/layout.tsx` is
dark and always dark, and sets `data-theme="dark"`. These are two products, not a theme
pair. Never add a toggle, a third palette, or a dark variant of a studio screen.

Put a build, configure or audit screen in `(studio)`. Put a watch-it-happen-now screen
in `(ops)`. `SideNav` groups them as Build / Run / Trust; a nav slot with no screen
renders reserved and inert rather than as a dead link, so add the screen and the slot
together.

## Tokens and primitives

- Colour is a Tailwind class over a token from `@theme` in `src/app/globals.css`:
  `bg-panel`, `bg-canvas`, `text-ink-2`, `text-muted-3`, `border-line`, and the
  `ops-` prefixed set on dark. No raw hex, no `rgba()`, no new token unless a value
  genuinely repeats.
- `accent` orange means a number breached a budget. It is not a brand accent and not
  decoration.
- Reuse `src/components/ui/primitives.tsx`: `Eyebrow`, `Button`, `Chip` and friends.
  Extend a primitive instead of hand-rolling a variant. Button variants already cover
  both palettes (`primary`, `ghost`, `dark`, `ops`, `ops-primary`).
- Numbers go in `font-mono`, which is tabular globally, so columns do not shiver as
  values tick.
- The house look is information-dense: no decorative cards, no pill chrome, no
  light-grey subtitle lines, tight bracketed sizes (`text-[12px]`) as used throughout.

## Copy

Plain ASCII. No em dash, no smart quote, no middot in new strings. Minimal words. No
model or provider name anywhere a customer can read, with one exception: the builder's
stage router names models because choosing them is the product.

Existing components break the ASCII rule in many places. Fix what you are already
editing; do not open a sweep.

## Agent state

Never draw a waveform for an agent. State is a `thinking-orbs` orb, and the one mapping
lives in `src/lib/activity.ts`: nine `CallActivity` values, nine orb states, one label
and one aria string each. Adding a state means editing that map, not a component. The
two surviving waveforms are audio, not agents: the recording scrubber on call detail and
the disclosure clip in the campaign gate.

## The monitor is the hard screen

`src/components/ops/LiveCallGrid.tsx` must survive a busy hour on a wallboard:

- Rows come from `useVirtualGrid`; only visible rows plus a small overscan render.
  Anything you add per card is paid for on every visible card.
- Past `LIVE_ORB_BUDGET` (24) visible cards, orbs render a static frame. State stays
  legible, motion stops. Do not raise that number to make a demo look busy.
- Columns derive from measured width via `ResizeObserver`. No per-screen breakpoints.
- Filters narrow the set with a capped scan and report an estimate past the cap. Never
  add a filter that walks every call on each keystroke.
- No continuously repainting CSS animation anywhere on this screen.

Test it with data: `SEED_CALLS=40 pnpm seed`, and check both a narrow window and a wide
one.

## Verify

```bash
pnpm typecheck
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/<route>   # redirect while signed out
```

Then look at it. Screenshot the surface in its own shell, and both shells if the change
crosses them. If browser automation is unavailable in the session, say the screenshot is
outstanding rather than implying you saw it. Reduced motion is respected globally in
`globals.css`; check anything animated still reads when motion is off.
