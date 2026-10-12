import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'

const MENU_W = 160
const MENU_H = 48

// A one-item right-click menu at the cursor (x, y: the event's clientX/Y,
// nudged back inside the viewport here). A mouse right-click is deliberate
// enough that the item acts immediately, without a confirmation dialog.
//
// Portalled to <body> so a transformed ancestor (a block mid-drag) can't
// re-anchor its fixed position. React still bubbles events from a portal up
// the component tree, though, so they are stopped at the root — otherwise a
// click here would also open whatever the menu was opened over.
export default function ContextMenu({ x, y, label, onSelect, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('mousedown', onClose)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onClose)
    window.addEventListener('scroll', onClose, true)
    return () => {
      window.removeEventListener('mousedown', onClose)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [onClose])

  const stop = (e) => e.stopPropagation()

  return createPortal(
    <div
      className="context-menu"
      role="menu"
      style={{
        left: Math.min(x, window.innerWidth - MENU_W - 8),
        top: Math.min(y, window.innerHeight - MENU_H - 8),
      }}
      onMouseDown={stop}
      onPointerDown={stop}
      onTouchStart={stop}
      onClick={stop}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation() }}
    >
      <button
        type="button"
        role="menuitem"
        className="context-menu-item danger"
        autoFocus
        onClick={() => { onSelect(); onClose() }}
      >
        {label}
      </button>
    </div>,
    document.body
  )
}
