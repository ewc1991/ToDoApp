import React, { useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'

export default function Modal({ title, onClose, children, footer }) {
  const onCloseRef = useRef(onClose)
  const modalRef = useRef(null)
  useEffect(() => { onCloseRef.current = onClose })

  // Escape key to close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCloseRef.current() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Focus trap: keep Tab/Shift+Tab inside the modal; restore focus on close
  useEffect(() => {
    const modal = modalRef.current
    if (!modal) return
    const prevFocused = document.activeElement

    const trap = (e) => {
      if (e.key !== 'Tab') return
      const focusable = [...modal.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )]
      if (focusable.length === 0) { e.preventDefault(); return }
      const first = focusable[0]
      const last  = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }

    modal.addEventListener('keydown', trap)
    return () => {
      modal.removeEventListener('keydown', trap)
      if (prevFocused && document.body.contains(prevFocused)) prevFocused.focus()
    }
  }, [])

  const content = (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCloseRef.current() }}>
      <div className="modal" ref={modalRef} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onCloseRef.current} aria-label="Close">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )

  return ReactDOM.createPortal(content, document.body)
}
