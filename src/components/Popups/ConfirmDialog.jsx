import React from 'react'
import Modal from './Modal.jsx'

// Destructive confirmations used to go through window.confirm, which blocks the
// event loop, can't be styled, and looks like a different application inside an
// installed PWA. Modal already handles stacking, Escape and the focus trap, so a
// confirmation opened from inside another dialog behaves correctly.
export default function ConfirmDialog({
  title = 'Are you sure?',
  message,
  detail,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <div style={{ flex: 1 }} />
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>{confirmLabel}</button>
        </>
      }
    >
      <p className="confirm-message">{message}</p>
      {detail && <p className="confirm-detail">{detail}</p>}
    </Modal>
  )
}
