/*
 * Clerk ships its own card. The auth screens already are a paper card with a
 * heading, so the widget is stripped back to bare fields and given the studio
 * palette from globals.css. Keep the two in step: a raw hex here is the one
 * place the token rule cannot reach, because Clerk renders outside our CSS.
 */
export const authAppearance = {
  variables: {
    colorPrimary: '#c2451f',
    colorBackground: '#ffffff',
    colorText: '#1c1917',
    colorTextSecondary: '#78706a',
    colorInputBackground: '#ffffff',
    colorInputText: '#1c1917',
    colorDanger: '#c2451f',
    colorSuccess: '#0f766e',
    borderRadius: '7px',
    fontFamily: 'var(--font-instrument-sans), system-ui, sans-serif',
    fontSize: '13px',
  },
  elements: {
    // Layout overrides are objects, not classes. Clerk's own stylesheet loads
    // after ours and wins a specificity tie, so a utility class silently does
    // nothing here while an inline style holds.
    rootBox: { width: '100%' },
    cardBox: { width: '100%', border: 'none', boxShadow: 'none' },
    card: { background: 'transparent', boxShadow: 'none', padding: 0, gap: '16px' },
    header: { display: 'none' },
    footer: { background: 'transparent', borderTop: 'none' },
    footerAction: 'justify-center',
    formButtonPrimary:
      'bg-accent hover:bg-accent-deep text-white font-sans text-[13px] font-semibold normal-case tracking-normal shadow-none py-[11px]',
    formFieldLabel: 'font-mono text-[10px] font-semibold tracking-[0.07em] text-muted-4 uppercase',
    formFieldInput: 'border-line bg-panel text-[13px] text-ink focus:border-accent',
    socialButtonsBlockButton: 'border-line text-ink',
    dividerLine: 'bg-line',
    dividerText: 'font-sans text-[11px] text-muted',
  },
}
