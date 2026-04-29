import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { useToast } from '../../components/toast'
import { setAppSettings } from '../../lib/api/dekenClient'
import { useAppSettings } from '../../contexts/AppSettingsContext'
import './DevPage.css'

export function DevPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const { settings, refresh } = useAppSettings()
  const [isClearing, setIsClearing] = useState(false)
  const [isTogglingWifi, setIsTogglingWifi] = useState(false)

  async function handleClearTransactions() {
    if (!window.confirm(t('dev.confirmClear'))) {
      return
    }
    
    setIsClearing(true)
    try {
      const res = await window.deken.devTools.clearAllTransactions()
      if (res.ok) {
        toast.success(t('dev.successClear'))
      } else {
        toast.error(res.error.message || 'Error clearing transactions')
      }
    } catch {
      toast.error('Unexpected error')
    } finally {
      setIsClearing(false)
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
                disabled={isClearing}
              >
                <Trash2 size={16} />
                {isClearing ? '...' : t('dev.clearTransactions')}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
