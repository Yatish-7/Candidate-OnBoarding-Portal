import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircleFilled, CloseCircleFilled, InfoCircleFilled, WarningFilled } from '@ant-design/icons'
import Button from './Button.jsx'
import Modal from './Modal.jsx'
import { cn } from './cn.js'

// Toasts (replaces antd's message) and a confirm dialog (replaces Popconfirm /
// modal.confirm), provided once at the app root.
const ToastContext = createContext(null)
const ConfirmContext = createContext(null)

const TOAST_TONES = {
  success: { Icon: CheckCircleFilled, color: 'text-success' },
  error: { Icon: CloseCircleFilled, color: 'text-danger' },
  warning: { Icon: WarningFilled, color: 'text-warning' },
  info: { Icon: InfoCircleFilled, color: 'text-brand' },
}

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [confirmState, setConfirmState] = useState(null)
  const idRef = useRef(0)

  const remove = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), [])

  const push = useCallback(
    (tone, content, duration = 3200) => {
      const id = ++idRef.current
      setToasts((list) => [...list, { id, tone, content }])
      if (duration) setTimeout(() => remove(id), duration)
      return id
    },
    [remove],
  )

  const toast = useMemo(
    () => ({
      success: (m, d) => push('success', m, d),
      error: (m, d) => push('error', m, d),
      warning: (m, d) => push('warning', m, d),
      info: (m, d) => push('info', m, d),
    }),
    [push],
  )

  // confirm({...}) resolves true if the user confirms, false otherwise.
  const confirm = useCallback(
    (opts) => new Promise((resolve) => setConfirmState({ ...opts, resolve })),
    [],
  )

  function closeConfirm(result) {
    confirmState?.resolve(result)
    setConfirmState(null)
  }

  return (
    <ToastContext.Provider value={toast}>
      <ConfirmContext.Provider value={confirm}>
        {children}
        {createPortal(
          <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4">
            {toasts.map(({ id, tone, content }) => {
              const { Icon, color } = TOAST_TONES[tone] ?? TOAST_TONES.info
              return (
                <div
                  key={id}
                  className="oi-toast-in pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl border border-line bg-white px-4 py-3 shadow-lg"
                  role="status"
                >
                  <Icon className={cn('mt-0.5 shrink-0', color)} />
                  <span className="text-sm text-ink">{content}</span>
                  <button
                    type="button"
                    onClick={() => remove(id)}
                    className="ml-1 text-faint hover:text-ink"
                    aria-label="Dismiss"
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>,
          document.body,
        )}
        <Modal
          open={!!confirmState}
          onClose={() => closeConfirm(false)}
          title={confirmState?.title ?? 'Are you sure?'}
          width={420}
          footer={
            <>
              <Button variant="default" onClick={() => closeConfirm(false)}>
                {confirmState?.cancelText ?? 'Cancel'}
              </Button>
              <Button
                variant={confirmState?.danger ? 'danger' : 'primary'}
                onClick={() => closeConfirm(true)}
              >
                {confirmState?.confirmText ?? 'Confirm'}
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted">{confirmState?.description}</p>
        </Modal>
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <UIProvider>')
  return ctx
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within <UIProvider>')
  return ctx
}
