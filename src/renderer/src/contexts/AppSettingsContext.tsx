import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getAppSettings } from '../lib/api/dekenClient'
import type { AppSettingsDto } from '../../../shared/ipc/types'

const DEFAULT: AppSettingsDto = {
  shopName: '',
  lbpPerUsd: 89_500,
  showClassicMenu: false,
  navLayout: 'sidebar',
  printReceiptAfterSale: false,
  receiptPaper: 'a4',
  showDevTools: true,
  showWifiSection: false,
}

type Ctx = {
  settings: AppSettingsDto
  loaded: boolean
  refresh: () => Promise<void>
}

const Ctx = createContext<Ctx>({ settings: DEFAULT, loaded: false, refresh: async () => {} })

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettingsDto>(DEFAULT)
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    try {
      if (window.deken == null) {
        setSettings(DEFAULT)
        return
      }
      const r = await getAppSettings()
      if (r.ok) {
        setSettings(r.data)
      } else {
        setSettings(DEFAULT)
      }
    } catch {
      setSettings(DEFAULT)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo(() => ({ settings, loaded, refresh }), [settings, loaded, refresh])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAppSettings() {
  return useContext(Ctx)
}

export function getDefaultLbpPerUsd() {
  return DEFAULT.lbpPerUsd
}
