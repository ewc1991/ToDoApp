import { useEffect } from 'react';

// iOS shrinks the *visual* viewport when the keyboard opens but not the *layout*
// viewport, then scrolls — dragging position:fixed elements out of place.
// Publish the visual viewport's height and offset as CSS variables so overlays
// can position against them, and flag the keyboard so the bottom bar can hide.
const KEYBOARD_THRESHOLD = 120; // px of lost height that means "keyboard", not just URL-bar chrome

export function useVisualViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const apply = () => {
      const root = document.documentElement;
      root.style.setProperty('--vv-height', `${vv.height}px`);
      root.style.setProperty('--vv-offset', `${vv.offsetTop}px`);
      const hidden = window.innerHeight - vv.height;
      document.body.classList.toggle('kb-open', hidden > KEYBOARD_THRESHOLD);
    };

    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      document.body.classList.remove('kb-open');
    };
  }, []);
}
