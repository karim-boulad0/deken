import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Trash2, Database } from 'lucide-react'
import { useToast } from '../../components/toast'
import { setAppSettings, clearTable, clearAllTransactions } from '../../lib/api/dekenClient'
import { useAppSettings } from '../../contexts/AppSettingsContext'
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

export function DevPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const { settings, refresh } = useAppSettings()
  const [isClearingAll, setIsClearingAll] = useState(false)
  const [clearingTable, setClearingTable] = useState<string | null>(null)
  const [isTogglingWifi, setIsTogglingWifi] = useState(false)

  async function handleClearTransactions() {
    if (!window.confirm(t('dev.confirmClear'))) {
      return
    }
    
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

  async function handleClearTable(tableName: string) {
    const tableLabel = t(`dev.tables.${tableName}`)
    if (!window.confirm(t('dev.confirmClearTable', { table: tableLabel }))) {
      return
    }

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

  async function handleCornerDoubleClick() {
    if (isTogglingWifi) {
      return
    }
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

  return (
    <div className="dev-page fade-in">
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
              onDoubleClick={() => void handleCornerDoubleClick()}
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
                onClick={() => void handleClearTransactions()}
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
                    onClick={() => void handleClearTable(table)}
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
