import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getActivationStatus, verifyActivation } from '../lib/api/dekenClient'
import './ActivationGate.css'
import type { IpcResult } from '../../../shared/ipc/types'

// Change this value to control auto-lock interval.
// const AUTO_LOCK_MINUTES = 1
// const AUTO_LOCK_MS = AUTO_LOCK_MINUTES * 10 * 1000
const AUTO_LOCK_MINUTES = 259200
const AUTO_LOCK_MS = AUTO_LOCK_MINUTES * 60 * 1000
const MAX_TIMEOUT_MS = 2_147_483_647
const LAST_UNLOCK_AT_KEY = 'deken.activation.lastUnlockAtMs'

function readLastUnlockAt(): number | null {
  const raw = window.localStorage.getItem(LAST_UNLOCK_AT_KEY)
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

function writeLastUnlockAt(value: number) {
  window.localStorage.setItem(LAST_UNLOCK_AT_KEY, String(value))
}
type Props = {
  children: React.ReactNode
}

export function ActivationGate({ children }: Props) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [activated, setActivated] = useState(false)
  const [locked, setLocked] = useState(false)
  const [machineCode, setMachineCode] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorKey, setErrorKey] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const r = await getActivationStatus()
      if (r.ok) {
        setActivated(r.data.activated)
        if (!r.data.activated) {
          setLocked(false)
          window.localStorage.removeItem(LAST_UNLOCK_AT_KEY)
        } else {
          const lastUnlockAt = readLastUnlockAt()
          const shouldRequirePasscode = lastUnlockAt == null || Date.now() - lastUnlockAt >= AUTO_LOCK_MS
          setLocked(shouldRequirePasscode)
        }
        setMachineCode(r.data.machineCode)
      } else {
        setActivated(false)
        setLocked(false)
      }
      setLoading(false)
    })()
  }, [])

  useEffect(() => {
    if (!activated || locked) {
      return
    }

    let timer: ReturnType<typeof setTimeout> | null = null
    const lastUnlockAt = readLastUnlockAt() ?? Date.now()
    const deadline = lastUnlockAt + AUTO_LOCK_MS
    const scheduleToDeadline = () => {
      const remaining = deadline - Date.now()
      if (remaining <= 0) {
        setLocked(true)
        setCode('')
        setErrorKey(null)
        return
      }
      timer = setTimeout(scheduleToDeadline, Math.min(remaining, MAX_TIMEOUT_MS))
    }
    scheduleToDeadline()

    return () => {
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [activated, locked])

  async function onVerify() {
    if (busy) return
    setBusy(true)
    setErrorKey(null)
    const r = await verifyActivation({ code })
    setBusy(false)
    if (r.ok && r.data.activated) {
      writeLastUnlockAt(Date.now())
      setActivated(true)
      setLocked(false)
      setCode('')
      return
    }
    const m = mapActivationError(r)
    setErrorKey(m)
  }

  function mapActivationError(r: IpcResult<{ activated: boolean }>): string {
    if (r.ok) {
      return 'activation_invalid_code'
    }
    const m = r.error.message.trim()
    if (m === 'activation_invalid_code' || m === 'invalid_input') {
      return m
    }
    return 'internal_error'
  }

  if (loading) {
    return <div className="actg actg--loading">{t('activation.loading')}</div>
  }
  if (activated && !locked) {
    return <>{children}</>
  }
  return (
    <div className="actg">
      <section className="actg__card" aria-labelledby="activation-title">
        <h1 id="activation-title" className="actg__title">
          {t('activation.title')}
        </h1>
        <p className="actg__intro">{t('activation.intro')}</p>
        <p className="actg__machine">
          {t('activation.machineCode')}: <strong>{machineCode}</strong>
        </p>
        <label className="actg__field">
          <span>{t('activation.codeLabel')}</span>
          <input
            className="actg__input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !busy && code.trim() !== '') {
                e.preventDefault()
                void onVerify()
              }
            }}
            autoComplete="off"
            spellCheck={false}
            placeholder={t('activation.codePlaceholder')}
          />
        </label>
        {errorKey ? <p className="actg__error">{t(`activation.errors.${errorKey}`)}</p> : null}
        <button type="button" className="actg__btn" disabled={busy || code.trim() === ''} onClick={() => void onVerify()}>
          {busy ? t('activation.verifying') : t('activation.verifyButton')}
        </button>
      </section>
    </div>
  )
}
