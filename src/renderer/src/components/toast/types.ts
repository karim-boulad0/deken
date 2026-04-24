export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

export type ShowToastInput = {
  message: string
  variant?: ToastVariant
  /** Time on screen in ms. Default 4500. */
  duration?: number
}

export type ToastItem = {
  id: string
  message: string
  variant: ToastVariant
}

export type ToastApi = {
  show: (input: ShowToastInput) => void
  success: (message: string, duration?: number) => void
  error: (message: string, duration?: number) => void
  info: (message: string, duration?: number) => void
  warning: (message: string, duration?: number) => void
  /** Remove a toast if you kept its id from an advanced `show` — optional for v1. */
  dismiss: (id: string) => void
}
