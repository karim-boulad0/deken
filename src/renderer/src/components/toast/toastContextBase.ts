import { createContext } from 'react'
import type { ToastApi } from './types'

export const ToastStateContext = createContext<ToastApi | null>(null)
