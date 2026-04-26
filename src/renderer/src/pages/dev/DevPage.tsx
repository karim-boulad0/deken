import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { useToast } from '../../components/toast'
import './DevPage.css'

export function DevPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const [isClearing, setIsClearing] = useState(false)

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
    } catch (e) {
      toast.error('Unexpected error')
    } finally {
      setIsClearing(false)
    }
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
