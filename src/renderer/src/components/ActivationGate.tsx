import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getActivationStatus, verifyActivation } from '../lib/api/dekenClient'
import './ActivationGate.css'
import type { IpcResult } from '../../../shared/ipc/types'

type Props = {
  children: React.ReactNode
}

export function ActivationGate({ children }: Props) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [activated, setActivated] = useState(false)
  const [machineCode, setMachineCode] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorKey, setErrorKey] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const r = await getActivationStatus()
      if (r.ok) {
        setActivated(r.data.activated)
        setMachineCode(r.data.machineCode)
      } else {
        setActivated(false)
      }
      setLoading(false)
    })()
  }, [])

  async function onVerify() {
    if (busy) return
    setBusy(true)
    setErrorKey(null)
    const r = await verifyActivation({ code })
    setBusy(false)
    if (r.ok && r.data.activated) {
      setActivated(true)
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
  if (activated) {
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
