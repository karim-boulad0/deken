import { useContext } from 'react'
import { ToastStateContext } from './toastContextBase'
import type { ToastApi } from './types'

export function useToast(): ToastApi {
  const v = useContext(ToastStateContext)
  if (!v) {
    throw new Error('useToast must be used within ToastProvider (see main.tsx).')
  }
  return v
}
