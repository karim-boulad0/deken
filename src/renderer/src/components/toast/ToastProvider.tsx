import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastStateContext } from './toastContextBase'
import type { ShowToastInput, ToastApi, ToastItem, ToastVariant } from './types'
import './toast.css'

const MAX_VISIBLE = 5
const DEFAULT_DURATION = 4500

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const timers = useRef<Map<string, number>>(new Map())

  const clearTimer = useCallback((id: string) => {
    const t = timers.current.get(id)
    if (t != null) {
      window.clearTimeout(t)
      timers.current.delete(id)
    }
  }, [])

  const remove = useCallback(
    (id: string) => {
      clearTimer(id)
      setItems((prev) => prev.filter((x) => x.id !== id))
    },
    [clearTimer],
  )

  const show = useCallback(
    (input: ShowToastInput) => {
      const id = crypto.randomUUID()
      const variant: ToastVariant = input.variant ?? 'info'
      const duration = input.duration ?? DEFAULT_DURATION
      setItems((prev) => {
        const next: ToastItem[] = [
          ...prev,
          { id, message: input.message, variant },
        ]
        if (next.length > MAX_VISIBLE) {
          const drop = next[0]!
          clearTimer(drop.id)
          return next.slice(1)
        }
        return next
      })
      const tid = window.setTimeout(() => remove(id), duration)
      timers.current.set(id, tid)
    },
    [clearTimer, remove],
  )

  const success = useCallback(
    (message: string, duration = DEFAULT_DURATION) => {
      show({ message, variant: 'success', duration })
    },
    [show],
  )

  const error = useCallback(
    (message: string, duration = DEFAULT_DURATION) => {
      show({ message, variant: 'error', duration })
    },
    [show],
  )

  const info = useCallback(
    (message: string, duration = DEFAULT_DURATION) => {
      show({ message, variant: 'info', duration })
    },
    [show],
  )

  const warning = useCallback(
    (message: string, duration = DEFAULT_DURATION) => {
      show({ message, variant: 'warning', duration })
    },
    [show],
  )

  const dismiss = useCallback(
    (id: string) => {
      remove(id)
    },
    [remove],
  )

  const api = useMemo<ToastApi>(
    () => ({ show, success, error, info, warning, dismiss }),
    [dismiss, error, info, show, success, warning],
  )

  useEffect(
    () => () => {
      for (const id of timers.current.keys()) {
        clearTimer(id)
      }
      timers.current.clear()
    },
    [clearTimer],
  )

  return (
    <ToastStateContext.Provider value={api}>
      {children}
      <div className="dken-toast-anchor" aria-atomic="false">
        {items.map((t) => (
          <div
            key={t.id}
            className="dken-toast"
            data-variant={t.variant}
            role="status"
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastStateContext.Provider>
  )
}
