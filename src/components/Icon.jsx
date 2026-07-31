import React from 'react'

// Stroke icons on a 16x16 grid, stroke-width 1.6, round caps/joins.
// They inherit `currentColor` so they sit at the same visual weight as the
// outlines around them. Never emoji — emoji render differently per platform,
// arrive in colours we didn't choose, and fight a flat outlined style.

const PATHS = {
  check:      <polyline points="3 8.5 6.5 12 13 4.5" />,
  plus:       <><line x1="8" y1="3" x2="8" y2="13" /><line x1="3" y1="8" x2="13" y2="8" /></>,
  close:      <><line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" /></>,
  chevronLeft:  <polyline points="10 3 5 8 10 13" />,
  chevronRight: <polyline points="6 3 11 8 6 13" />,
  calendar: (
    <>
      <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
      <line x1="11" y1="2" x2="11" y2="5" />
      <line x1="5" y1="2" x2="5" y2="5" />
      <line x1="2.5" y1="7" x2="13.5" y2="7" />
    </>
  ),
  list: (
    <>
      <polyline points="2.5 8 4.5 10 8 5.5" />
      <line x1="10" y1="5" x2="14" y2="5" />
      <line x1="10" y1="11" x2="14" y2="11" />
      <polyline points="2.5 13 4.5 15 8 10.5" />
    </>
  ),
  repeat: (
    <>
      <polyline points="4 2.5 1.5 5 4 7.5" />
      <path d="M1.5 5h9a3.5 3.5 0 0 1 3.5 3.5" />
      <polyline points="12 13.5 14.5 11 12 8.5" />
      <path d="M14.5 11h-9A3.5 3.5 0 0 1 2 7.5" />
    </>
  ),
  note: (
    <>
      <path d="M9.5 2H4.5a1.5 1.5 0 0 0-1.5 1.5v9A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V5.5z" />
      <polyline points="9.5 2 9.5 5.5 13 5.5" />
      <line x1="5.5" y1="8.5" x2="10.5" y2="8.5" />
      <line x1="5.5" y1="11" x2="10.5" y2="11" />
    </>
  ),
  mic: (
    <>
      <rect x="6" y="1.5" width="4" height="8" rx="2" />
      <path d="M3.5 7a4.5 4.5 0 0 0 9 0" />
      <line x1="8" y1="11.5" x2="8" y2="14.5" />
    </>
  ),
  undo: (
    <>
      <polyline points="5 4 2 7 5 10" />
      <path d="M2 7h6.5A4.5 4.5 0 0 1 13 11.5v0A4.5 4.5 0 0 1 8.5 16" />
    </>
  ),
  grip: (
    <>
      <circle cx="6" cy="4" r=".9" /><circle cx="10" cy="4" r=".9" />
      <circle cx="6" cy="8" r=".9" /><circle cx="10" cy="8" r=".9" />
      <circle cx="6" cy="12" r=".9" /><circle cx="10" cy="12" r=".9" />
    </>
  ),
  warning: (
    <>
      <path d="M8 2.2 1.8 13.2h12.4z" />
      <line x1="8" y1="6.5" x2="8" y2="9.5" />
      <line x1="8" y1="11.4" x2="8" y2="11.4" />
    </>
  ),
  arrowRight: (
    <>
      <line x1="2.5" y1="8" x2="13" y2="8" />
      <polyline points="9.5 4.5 13 8 9.5 11.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="8" cy="8" r="6" />
      <polyline points="8 4.5 8 8 10.5 9.5" />
    </>
  ),
}

// Filled dot — used for the "listening" indicator, where a stroke reads too light.
const FILLED = new Set(['dot'])

export default function Icon({ name, size = 16, className, style, ...rest }) {
  if (name === 'dot') {
    return (
      <svg viewBox="0 0 16 16" width={size} height={size} className={className}
        style={style} aria-hidden="true" focusable="false" {...rest}>
        <circle cx="8" cy="8" r="4" fill="currentColor" />
      </svg>
    )
  }

  const path = PATHS[name]
  if (!path) return null

  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {path}
    </svg>
  )
}

export { PATHS, FILLED }
