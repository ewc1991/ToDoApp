import { useEffect } from 'react'

const BASE_TITLE = 'Planner'
const FAVICON_HREF = '/favicon.svg'

// Same artwork as public/favicon.svg, plus a red dot badge in the corner.
// Built as a string rather than fetched/canvas-drawn so swapping it in is
// synchronous and needs no network round trip.
const BADGED_FAVICON = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#E8604A"/>
      <stop offset="100%" stop-color="#E2AF1C"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="114" fill="url(#bg)"/>
  <rect x="28" y="28" width="456" height="456" rx="90" fill="none"
        stroke="rgba(255,255,255,0.18)" stroke-width="3"/>
  <path d="M126 266 L218 358 L386 154"
        stroke="white" stroke-width="58"
        stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <circle cx="400" cy="112" r="88" fill="#EF294C" stroke="#fff" stroke-width="16"/>
</svg>
`)}`

// Makes unfinished due-today tasks hard to miss outside the open tab itself:
// the favicon gets a red dot the whole time, and the tab title alternates
// with a warning while the tab is in the background (the classic "you have
// unread messages" trick) — both pointless once the tab is focused or there
// is nothing left due today.
export function useDueTodayAlert(count) {
  useEffect(() => {
    const link = document.querySelector('link[rel="icon"][type="image/svg+xml"]')
    if (link) link.href = count > 0 ? BADGED_FAVICON : FAVICON_HREF
    return () => { if (link) link.href = FAVICON_HREF }
  }, [count])

  useEffect(() => {
    if (!count) { document.title = BASE_TITLE; return }

    let flipped = false
    const tick = () => {
      if (document.hidden) {
        flipped = !flipped
        document.title = flipped ? `⚠ ${count} Due Today` : BASE_TITLE
      } else {
        document.title = BASE_TITLE
      }
    }
    const id = setInterval(tick, 1200)
    // Snap back the moment the tab regains focus, rather than waiting out
    // whatever's left of the current interval.
    const onVisible = () => { if (!document.hidden) document.title = BASE_TITLE }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      document.title = BASE_TITLE
    }
  }, [count])
}
