import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CloseOutlined } from '@ant-design/icons'
import { cn } from './cn.js'

// Stops the page behind a dialog from scrolling while it's open.
function useLockBody(open) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])
}

function useEscape(open, onClose) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
}

// A centered dialog. `footer` is rendered in the action row; pass `footer={null}`
// to hide it. `width` is a max width in px.
export default function Modal({ open, onClose, title, children, footer, width = 520, className, dismissable = true }) {
  useLockBody(open)
  useEscape(open, dismissable ? onClose : undefined)
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div
        className="fixed inset-0 bg-ink/40 backdrop-blur-[2px]"
        onClick={dismissable ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn('oi-pop relative my-8 w-full rounded-2xl bg-white shadow-2xl', className)}
        style={{ maxWidth: width }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {dismissable && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid size-8 place-items-center rounded-lg text-faint transition-colors hover:bg-black/5 hover:text-ink"
            >
              <CloseOutlined />
            </button>
          )}
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer !== null && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// A panel that slides in from the right (used for the audit-entry details).
export function Drawer({ open, onClose, title, children, width = 440 }) {
  useLockBody(open)
  useEscape(open, onClose)
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        className="absolute right-0 top-0 flex h-full w-full flex-col bg-white shadow-2xl"
        style={{ maxWidth: width }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-lg text-faint transition-colors hover:bg-black/5 hover:text-ink"
          >
            <CloseOutlined />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
