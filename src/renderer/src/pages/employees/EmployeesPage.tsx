import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PermissionModule, UserWithPermissionsDto } from '../../../../shared/ipc/types'
import {
  createUser,
  deleteUser,
  listUsers,
  resetUserCredentials,
  setUserPermissions,
  updateUser,
} from '../../lib/api/dekenClient'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../components/toast'
import './EmployeesPage.css'

const MODULES: PermissionModule[] = [
  'dashboard',
  'pos',
  'products',
  'debts',
  'suppliers',
  'expenses',
  'cashflow',
  'reports',
  'settings',
  'employees',
]

export function EmployeesPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const { hasPermission } = useAuth()
  const [rows, setRows] = useState<UserWithPermissionsDto[]>([])
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<'admin' | 'employee'>('employee')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [selectedPermissions, setSelectedPermissions] = useState<PermissionModule[]>(['dashboard', 'pos'])

  const canAccess = hasPermission('employees')

  const refresh = useCallback(async () => {
    setLoading(true)
    const r = await listUsers()
    setLoading(false)
    if (!r.ok) {
      toast.error(t('employees.errors.load_failed'))
      return
    }
    setRows(r.data)
  }, [t, toast])

  useEffect(() => {
    if (canAccess) {
      void refresh()
    }
  }, [canAccess, refresh])

  const systemAdmin = useMemo(() => rows.find((r) => r.user.isSystemAdmin), [rows])

  if (!canAccess) {
    return <p>{t('auth.permissionDenied')}</p>
  }

  return (
    <div className="emp">
      <header className="emp__header">
        <h1>{t('employees.title')}</h1>
        <p>{t('employees.intro')}</p>
      </header>

      {systemAdmin ? (
        <div className="emp__system-admin">
          <strong>{t('employees.systemAdmin')}</strong>: {systemAdmin.user.username}
        </div>
      ) : null}

      <section className="emp__create">
        <h2>{t('employees.create.title')}</h2>
        <div className="emp__grid">
          <input
            placeholder={t('employees.create.username')}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            placeholder={t('employees.create.fullName')}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <select value={role} onChange={(e) => setRole((e.target.value as 'admin' | 'employee') || 'employee')}>
            <option value="employee">{t('employees.role.employee')}</option>
            <option value="admin">{t('employees.role.admin')}</option>
          </select>
          <input
            placeholder={t('employees.create.password')}
            value={password}
            type="password"
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            placeholder={t('employees.create.pin')}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
        </div>
        <div className="emp__modules">
          {MODULES.map((m) => (
            <label key={m} className="emp__module">
              <input
                type="checkbox"
                checked={selectedPermissions.includes(m)}
                onChange={() => {
                  setSelectedPermissions((prev) =>
                    prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
                  )
                }}
              />
              {t(`employees.modules.${m}`)}
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            void (async () => {
              const r = await createUser({
                username,
                fullName,
                role,
                password: password || undefined,
                pin: pin || undefined,
                permissions: selectedPermissions,
              })
              if (!r.ok) {
                toast.error(t(`employees.errors.${r.error.message}`))
                return
              }
              toast.success(t('employees.toast.created'))
              setUsername('')
              setFullName('')
              setPassword('')
              setPin('')
              await refresh()
            })()
          }
        >
          {t('employees.create.submit')}
        </button>
      </section>

      <section className="emp__list">
        <h2>{t('employees.list.title')}</h2>
        {loading ? <p>{t('employees.loading')}</p> : null}
        <div className="emp__table">
          {rows.map(({ user, permissions }) => (
            <article key={user.id} className="emp__row">
              <div>
                <strong>{user.username}</strong> - {user.fullName}
              </div>
              <div className="emp__badges">
                <span>{user.role}</span>
                <span>{user.isActive ? t('employees.active') : t('employees.inactive')}</span>
                {user.isSystemAdmin ? <span>{t('employees.systemAdmin')}</span> : null}
              </div>
              <p>{permissions.map((p) => t(`employees.modules.${p}`)).join(' , ')}</p>
              {!user.isSystemAdmin ? (
                <div className="emp__actions">
                  <button
                    type="button"
                    onClick={() =>
                      void (async () => {
                        const r = await updateUser(user.id, { isActive: !user.isActive })
                        if (!r.ok) {
                          toast.error(t(`employees.errors.${r.error.message}`))
                          return
                        }
                        await refresh()
                      })()
                    }
                  >
                    {user.isActive ? t('employees.actions.disable') : t('employees.actions.enable')}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void (async () => {
                        const r = await setUserPermissions(user.id, {
                          permissions: user.role === 'admin' ? MODULES : ['dashboard', 'pos'],
                        })
                        if (!r.ok) {
                          toast.error(t(`employees.errors.${r.error.message}`))
                          return
                        }
                        await refresh()
                      })()
                    }
                  >
                    {t('employees.actions.applyDefaultPermissions')}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void (async () => {
                        const r = await resetUserCredentials(user.id, { password: '123456' })
                        if (!r.ok) {
                          toast.error(t(`employees.errors.${r.error.message}`))
                          return
                        }
                        toast.success(t('employees.toast.credentialsReset'))
                      })()
                    }
                  >
                    {t('employees.actions.resetPassword')}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void (async () => {
                        const r = await deleteUser(user.id)
                        if (!r.ok) {
                          toast.error(t(`employees.errors.${r.error.message}`))
                          return
                        }
                        await refresh()
                      })()
                    }
                  >
                    {t('employees.actions.delete')}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
