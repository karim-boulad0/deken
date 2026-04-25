import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AuthSessionDto, PermissionModule } from '../../../shared/ipc/types'
import { getAuthSession, login as apiLogin, logout as apiLogout } from '../lib/api/dekenClient'

type LoginInput = {
  username: string
  password?: string
  pin?: string
}

type AuthContextValue = {
  loaded: boolean
  session: AuthSessionDto | null
  permissions: PermissionModule[]
  hasPermission: (moduleKey: PermissionModule) => boolean
  refresh: () => Promise<void>
  login: (input: LoginInput) => Promise<{ ok: true } | { ok: false; message: string }>
  logout: () => Promise<void>
}

const Ctx = createContext<AuthContextValue>({
  loaded: false,
  session: null,
  permissions: [],
  hasPermission: () => false,
  refresh: async () => {},
  login: async () => ({ ok: false, message: 'not_ready' }),
  logout: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false)
  const [session, setSession] = useState<AuthSessionDto | null>(null)

  const refresh = useCallback(async () => {
    try {
      if (window.deken == null) {
        setSession(null)
        return
      }
      const r = await getAuthSession()
      setSession(r.ok ? r.data : null)
    } catch {
      setSession(null)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback(async (input: LoginInput) => {
    const r = await apiLogin(input)
    if (!r.ok) {
      return { ok: false as const, message: r.error.message }
    }
    setSession(r.data)
    return { ok: true as const }
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    setSession(null)
  }, [])

  const permissions = useMemo(() => session?.permissions ?? [], [session])
  const hasPermission = useCallback(
    (moduleKey: PermissionModule) => permissions.includes(moduleKey),
    [permissions],
  )

  const value = useMemo(
    () => ({ loaded, session, permissions, hasPermission, refresh, login, logout }),
    [loaded, session, permissions, hasPermission, refresh, login, logout],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  return useContext(Ctx)
}
