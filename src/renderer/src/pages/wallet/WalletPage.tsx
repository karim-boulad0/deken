import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  Banknote, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  History, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  User,
  Hash,
  Activity
} from 'lucide-react'
import { 
  getActiveWalletSession, 
  openWalletSession, 
  closeWalletSession, 
  addWalletTransaction, 
  getWalletBalance,
  listWalletTransactions
} from '../../lib/api/dekenClient'
import type { WalletSessionDto, WalletTransactionDto } from '../../../../shared/ipc/types'
import { useToast } from '../../components/toast'
import { formatLbp } from '../pos/formatPos'
import './WalletPage.css'

export function WalletPage() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const lng = i18n.language

  const [session, setSession] = useState<WalletSessionDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState<number>(0)
  const [history, setHistory] = useState<WalletTransactionDto[]>([])
  
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [showAdjustModal, setShowAdjustModal] = useState<'IN' | 'OUT' | null>(null)
  const [showCloseModal, setShowCloseModal] = useState(false)

  const [openingBalance, setOpeningBalance] = useState('')
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [closingBalance, setClosingBalance] = useState('')
  const [busy, setBusy] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const res = await getActiveWalletSession()
    if (res.ok) {
      setSession(res.data)
      if (res.data) {
        const [bRes, hRes] = await Promise.all([
          getWalletBalance(res.data.id),
          listWalletTransactions(res.data.id)
        ])
        if (bRes.ok) setBalance(bRes.data)
        if (hRes.ok) setHistory(hRes.data)
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleStartShift = async () => {
    const val = parseInt(openingBalance.replace(/[^0-9]/g, '')) || 0
    setBusy(true)
    const res = await openWalletSession({ openingBalanceLbp: val })
    setBusy(false)
    if (res.ok) {
      setSession(res.data)
      setBalance(val)
      setHistory([])
      setShowOpenModal(false)
      setOpeningBalance('')
      toast.success(t('wallet.toast.sessionStarted', { n: formatLbp(val, lng) }))
    } else {
      toast.error(t(`wallet.errors.${res.error.message}`, { defaultValue: res.error.message }))
    }
  }

  const handleAdjust = async () => {
    if (!session || !showAdjustModal) return
    const amount = parseInt(adjustAmount.replace(/[^0-9]/g, '')) || 0
    if (amount <= 0) {
      toast.error(t('wallet.errors.amount_invalid'))
      return
    }
    
    setBusy(true)
    const res = await addWalletTransaction({
      sessionId: session.id,
      amountLbp: amount,
      type: showAdjustModal,
      reason: adjustReason
    })
    
    if (res.ok) {
      const [bRes, hRes] = await Promise.all([
        getWalletBalance(session.id),
        listWalletTransactions(session.id)
      ])
      if (bRes.ok) setBalance(bRes.data)
      if (hRes.ok) setHistory(hRes.data)
      setShowAdjustModal(null)
      setAdjustAmount('')
      setAdjustReason('')
      toast.success(t('wallet.toast.transactionAdded'))
    } else {
      const msg = res.error.message
      if (msg === 'insufficient_balance') {
        toast.error(t('wallet.errors.insufficient_balance'))
      } else {
        toast.error(msg)
      }
    }
    setBusy(false)
  }

  const handleEndShift = async () => {
    if (!session) return
    const actual = parseInt(closingBalance.replace(/[^0-9]/g, '')) || 0
    
    setBusy(true)
    const res = await closeWalletSession({
      sessionId: session.id,
      actualClosingBalanceLbp: actual
    })
    setBusy(false)
    
    if (res.ok) {
      setSession(null)
      setBalance(0)
      setHistory([])
      setShowCloseModal(false)
      setClosingBalance('')
      const disc = actual - (res.data.expectedClosingBalanceLbp || 0)
      toast.success(t('wallet.toast.sessionClosed', { n: formatLbp(disc, lng) }))
    } else {
      toast.error(res.error.message)
    }
  }

  if (loading) {
    return (
      <div className="wallet-page wallet-page--loading">
        <div className="wallet-page__spinner" />
      </div>
    )
  }

  return (
    <div className="wallet-page">
      <header className="wallet-page__header">
        <div className="wallet-page__header-titles">
          <h1 className="wallet-page__title">{t('wallet.pageTitle')}</h1>
          <p className="wallet-page__intro">{t('wallet.intro')}</p>
        </div>
      </header>

      {!session ? (
        <div className="wallet-page__empty-state">
          <div className="wallet-page__empty-icon">
            <Banknote size={64} />
          </div>
          <h2>{t('wallet.status.inactive')}</h2>
          <button 
            className="wallet-page__btn wallet-page__btn--primary"
            onClick={() => setShowOpenModal(true)}
          >
            <Clock size={18} />
            {t('wallet.actions.startShift')}
          </button>
        </div>
      ) : (
        <div className="wallet-page__content">
          <div className="wallet-page__grid">
            <div className="wallet-card wallet-card--balance">
              <div className="wallet-card__header">
                <Banknote size={24} className="wallet-card__icon" />
                <h3>{t('wallet.summary.expected')}</h3>
              </div>
              <div className="wallet-card__value">{formatLbp(balance, lng)}</div>
              <div className="wallet-card__footer wallet-card__footer--row">
                <span className="wallet-card__meta">
                  <Clock size={13} />
                  {t('wallet.status.active', { at: new Date(session.openedAt).toLocaleTimeString(lng) })}
                </span>
                <span className="wallet-card__meta">
                  {t('wallet.status.opening', { n: formatLbp(session.openingBalanceLbp, lng) })}
                </span>
              </div>
            </div>

            <div className="wallet-card wallet-card--actions">
              <div className="wallet-card__header">
                <Activity size={24} className="wallet-card__icon" />
                <h3>{t('wallet.actions.history')}</h3>
              </div>
              <div className="wallet-page__action-buttons">
                <button 
                  className="wallet-page__btn wallet-page__btn--success"
                  onClick={() => setShowAdjustModal('IN')}
                >
                  <ArrowUpCircle size={18} />
                  {t('wallet.actions.addCash')}
                </button>
                <button 
                  className="wallet-page__btn wallet-page__btn--danger"
                  onClick={() => setShowAdjustModal('OUT')}
                >
                  <ArrowDownCircle size={18} />
                  {t('wallet.actions.withdrawCash')}
                </button>
                <button 
                  className="wallet-page__btn wallet-page__btn--secondary"
                  onClick={() => setShowCloseModal(true)}
                >
                  <CheckCircle2 size={18} />
                  {t('wallet.actions.endShift')}
                </button>
              </div>
            </div>
          </div>
          
          <div className="wallet-history">
            <div className="wallet-history__header">
              <History size={20} />
              <h3>{t('wallet.history.title')}</h3>
            </div>
            {history.length === 0 ? (
              <div className="wallet-history__empty">{t('wallet.history.empty')}</div>
            ) : (
              <table className="wallet-history__table">
                <thead>
                  <tr>
                    <th>{t('wallet.history.colWhen')}</th>
                    <th>{t('wallet.history.colType')}</th>
                    <th>{t('wallet.history.colAmount')}</th>
                    <th>{t('wallet.history.colReason')}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((tx) => (
                    <tr key={tx.id}>
                      <td className="wallet-history__cell-time">
                        {new Date(tx.createdAt).toLocaleTimeString(lng, { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>
                        <span className={`wallet-history__badge wallet-history__badge--${tx.type.toLowerCase()}`}>
                          {t(`wallet.form.type${tx.type === 'IN' ? 'In' : 'Out'}`)}
                        </span>
                      </td>
                      <td className="wallet-history__cell-amount">
                        {tx.type === 'OUT' ? '-' : '+'}{formatLbp(tx.amountLbp, lng)}
                      </td>
                      <td className="wallet-history__cell-reason">{tx.reason || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Start Session Modal */}
      {showOpenModal && (
        <div className="wallet-modal-overlay">
          <div className="wallet-modal">
            <div className="wallet-modal__header">
              <h3>{t('wallet.actions.startShift')}</h3>
            </div>
            <div className="wallet-modal__body">
              <div className="wallet-field">
                <label>{t('wallet.form.openingBalance')}</label>
                <div className="wallet-field__input-wrapper">
                  <Banknote size={18} />
                  <input 
                    type="text" 
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    placeholder="0"
                    autoFocus
                  />
                </div>
              </div>
            </div>
            <div className="wallet-modal__footer">
              <button 
                className="wallet-page__btn wallet-page__btn--secondary"
                onClick={() => setShowOpenModal(false)}
                disabled={busy}
              >
                {t('wallet.form.cancel')}
              </button>
              <button 
                className="wallet-page__btn wallet-page__btn--primary"
                onClick={handleStartShift}
                disabled={busy}
              >
                {t('wallet.form.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Cash Modal */}
      {showAdjustModal && (
        <div className="wallet-modal-overlay">
          <div className="wallet-modal">
            <div className="wallet-modal__header">
              <h3>{t(showAdjustModal === 'IN' ? 'wallet.actions.addCash' : 'wallet.actions.withdrawCash')}</h3>
            </div>
            <div className="wallet-modal__body">
              <div className="wallet-field">
                <label>{t('wallet.form.amount')}</label>
                <div className="wallet-field__input-wrapper">
                  <Banknote size={18} />
                  <input 
                    type="text" 
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    placeholder="0"
                    autoFocus
                  />
                </div>
              </div>
              <div className="wallet-field">
                <label>{t('wallet.form.reason')}</label>
                <input 
                  type="text" 
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder={t('wallet.form.reasonPlaceholder')}
                />
              </div>
            </div>
            <div className="wallet-modal__footer">
              <button 
                className="wallet-page__btn wallet-page__btn--secondary"
                onClick={() => setShowAdjustModal(null)}
                disabled={busy}
              >
                {t('wallet.form.cancel')}
              </button>
              <button 
                className={`wallet-page__btn wallet-page__btn--${showAdjustModal === 'IN' ? 'success' : 'danger'}`}
                onClick={handleAdjust}
                disabled={busy}
              >
                {t('wallet.form.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Session Modal */}
      {showCloseModal && (
        <div className="wallet-modal-overlay">
          <div className="wallet-modal">
            <div className="wallet-modal__header">
              <h3>{t('wallet.actions.endShift')}</h3>
            </div>
            <div className="wallet-modal__body">
              <div className="wallet-summary-preview">
                <div className="wallet-summary-preview__item">
                  <span>{t('wallet.summary.expected')}</span>
                  <strong>{formatLbp(balance, lng)}</strong>
                </div>
              </div>
              <div className="wallet-field">
                <label>{t('wallet.form.actualClosing')}</label>
                <div className="wallet-field__input-wrapper">
                  <Banknote size={18} />
                  <input 
                    type="text" 
                    value={closingBalance}
                    onChange={(e) => setClosingBalance(e.target.value)}
                    placeholder="0"
                    autoFocus
                  />
                </div>
              </div>
            </div>
            <div className="wallet-modal__footer">
              <button 
                className="wallet-page__btn wallet-page__btn--secondary"
                onClick={() => setShowCloseModal(false)}
                disabled={busy}
              >
                {t('wallet.form.cancel')}
              </button>
              <button 
                className="wallet-page__btn wallet-page__btn--primary"
                onClick={handleEndShift}
                disabled={busy}
              >
                {t('wallet.form.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Wrench(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  )
}
