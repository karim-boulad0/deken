import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Trash2, Database } from 'lucide-react'
import { useToast } from '../../components/toast'
import { setAppSettings, clearTable, clearAllTransactions } from '../../lib/api/dekenClient'
import { useAppSettings } from '../../contexts/AppSettingsContext'
import { Lock, ShieldAlert } from 'lucide-react'
import './DevPage.css'

const TABLES = [
  'products',
  'categories',
  'customers',
  'suppliers',
  'expenses',
  'expense_categories',
  'sales',
  'debt_payments',
  'supplier_invoices',
  'supplier_payments',
  'product_sizes',
  'product_flavors'
]

const DEV_PASSWORDS = ['karim12345', 'wassim12345', '1234512345', '13245']

export function DevPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const { settings, refresh } = useAppSettings()
  
  const [isClearingAll, setIsClearingAll] = useState(false)
  const [clearingTable, setClearingTable] = useState<string | null>(null)
  const [isTogglingWifi, setIsTogglingWifi] = useState(false)
  
  // Authorization states
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [authInput, setAuthInput] = useState('')
  const [pendingAction, setPendingAction] = useState<{ type: 'page' | 'action', action?: () => Promise<void> | void } | null>({ type: 'page' })

  function handleAuthSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (DEV_PASSWORDS.includes(authInput)) {
      const currentPending = pendingAction
      setAuthInput('')
      setPendingAction(null)
      
      if (currentPending?.type === 'page') {
        setIsAuthorized(true)
      } else if (currentPending?.action) {
        void currentPending.action()
      }
    } else {
      toast.error(t('dev.invalidPassword') || 'Invalid Password')
      if (pendingAction?.type === 'page') {
        // Optional: navigate away on multiple fails, but for now just let them try again
      }
    }
  }

  function requestActionAuth(action: () => Promise<void> | void) {
    setPendingAction({ type: 'action', action })
    setAuthInput('')
  }

  async function performClearTransactions() {
    if (!window.confirm(t('dev.confirmClear'))) return
    setIsClearingAll(true)
    try {
      const res = await clearAllTransactions()
      if (res.ok) {
        toast.success(t('dev.successClear'))
      } else {
        toast.error(res.error.message || 'Error clearing transactions')
      }
    } catch (err) {
      console.error('Failed to clear transactions:', err)
      toast.error('Unexpected error')
    } finally {
      setIsClearingAll(false)
    }
  }

  async function performClearTable(tableName: string) {
    const tableLabel = t(`dev.tables.${tableName}`)
    if (!window.confirm(t('dev.confirmClearTable', { table: tableLabel }))) return
    setClearingTable(tableName)
    try {
      const res = await clearTable(tableName)
      if (res.ok) {
        toast.success(t('dev.successClearTable', { table: tableLabel }))
      } else {
        toast.error(res.error.message || `Error clearing ${tableName}`)
      }
    } catch (err) {
      console.error(`Failed to clear table ${tableName}:`, err)
      toast.error('Unexpected error')
    } finally {
      setClearingTable(null)
    }
  }

  async function performCornerToggle() {
    setIsTogglingWifi(true)
    const next = !settings.showWifiSection
    const res = await setAppSettings({ showWifiSection: next })
    setIsTogglingWifi(false)
    if (!res.ok) {
      toast.error(t('dev.toggleWifiFailed'))
      return
    }
    await refresh()
    toast.success(next ? t('dev.wifiEnabled') : t('dev.wifiDisabled'))
  }

  // --- Render Authorization Gates ---

  // Page Entry Gate
  if (!isAuthorized && pendingAction?.type === 'page') {
    return (
      <div className="dev-page fade-in">
        <div className="dev-auth-screen">
          <div className="dev-auth-card">
            <div className="dev-auth-icon">
              <Lock size={48} />
            </div>
            <h2>{t('dev.title')}</h2>
            <p>{t('dev.passwordPrompt')}</p>
            <form onSubmit={handleAuthSubmit}>
              <input
                type="password"
                className="dev-auth-input"
                value={authInput}
                onChange={(e) => setAuthInput(e.target.value)}
                autoFocus
                placeholder="••••••"
              />
              <div className="dev-auth-actions">
                <button type="button" className="btn btn--ghost" onClick={() => navigate('/dashboard')}>
                  {t('common.cancel') || 'Cancel'}
                </button>
                <button type="submit" className="btn btn--primary">
                  {t('auth.login.submit') || 'Verify'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dev-page fade-in">
      {/* Action Authorization Modal Overlay */}
      {pendingAction?.type === 'action' && (
        <div className="dev-modal-overlay">
          <div className="dev-auth-card dev-auth-card--modal">
            <div className="dev-auth-icon dev-auth-icon--danger">
              <ShieldAlert size={32} />
            </div>
            <h3>{t('dev.dangerZone')}</h3>
            <p>{t('dev.passwordPrompt')}</p>
            <form onSubmit={handleAuthSubmit}>
              <input
                type="password"
                className="dev-auth-input"
                value={authInput}
                onChange={(e) => setAuthInput(e.target.value)}
                autoFocus
                placeholder="••••••"
              />
              <div className="dev-auth-actions">
                <button type="button" className="btn btn--ghost" onClick={() => setPendingAction(null)}>
                  {t('common.cancel') || 'Cancel'}
                </button>
                <button type="submit" className="btn btn--danger">
                  {t('auth.login.submit') || 'Verify Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <header className="page-header">
        <h1 className="page-title">{t('dev.title')}</h1>
      </header>

      <div className="dev-content">
        <section className="dev-section danger-zone">
          <h2 className="dev-section__title">
            <AlertTriangle className="dev-icon-danger" size={20} />
            {t('dev.dangerZone')}
            <button
              type="button"
              style={{ cursor: 'default' }}
              className="dev-corner-toggle"
              onDoubleClick={() => requestActionAuth(() => performCornerToggle())}
              aria-label={t('dev.cornerToggleAria')}
              title={t('dev.cornerToggleTitle')}
            />
          </h2>
          
          <div className="dev-card">
            <div className="dev-card__info">
              <h3>{t('dev.clearTransactions')}</h3>
              <p>{t('dev.clearTransactionsDesc')}</p>
            </div>
            <div className="dev-card__actions">
              <button 
                type="button" 
                className="btn btn--danger" 
                onClick={() => requestActionAuth(() => performClearTransactions())}
                disabled={isClearingAll}
              >
                <Trash2 size={16} />
                {isClearingAll ? '...' : t('dev.clearTransactions')}
              </button>
            </div>
          </div>

          <div className="dev-tables-grid">
            {TABLES.map((table) => (
              <div key={table} className="dev-card dev-card--small">
                <div className="dev-card__info">
                  <h3>
                    <Database size={14} style={{ opacity: 0.7 }} />
                    {t(`dev.tables.${table}`)}
                  </h3>
                </div>
                <div className="dev-card__actions">
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    onClick={() => requestActionAuth(() => performClearTable(table))}
                    disabled={clearingTable === table}
                  >
                    <Trash2 size={14} />
                    {clearingTable === table ? '...' : t('products.actions.delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
