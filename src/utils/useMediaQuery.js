import { useCallback, useSyncExternalStore } from 'react'

// Layout that differs by breakpoint is sometimes a rendering decision rather
// than a CSS one — the mobile planner renders one panel at a time instead of
// hiding the other, so an off-screen drop target can't swallow a drag.
export function useMediaQuery(query) {
  const subscribe = useCallback((onChange) => {
    const mql = window.matchMedia(query)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query])

  // Server snapshot: nothing renders server-side here, so desktop is the safe
  // default — it keeps both panels mounted.
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

// Matches the 680px breakpoint the stylesheet uses for mobile.
export const useIsMobile = () => useMediaQuery('(max-width: 680px)')
