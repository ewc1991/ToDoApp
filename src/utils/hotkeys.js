// Shared guards for the app's keyboard shortcuts.

export const isTypingTarget = (el) =>
  !!el && (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  );

// Modal renders into document.body via a portal, so this works from any component.
export const isModalOpen = () => document.querySelector('.modal-backdrop') !== null;

// Guard for bare single-key shortcuts ("n", "t"): skip while typing, while a
// modifier is held, and while a modal is open — otherwise pressing "n" with focus
// on a modal button fires the background page's add action.
export const shouldIgnoreHotkey = (e) =>
  isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey || isModalOpen();
