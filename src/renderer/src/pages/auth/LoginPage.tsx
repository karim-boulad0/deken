import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import './LoginPage.css'

function mapLoginError(message: string): string {
  if (
    message === 'invalid_credentials' ||
    message === 'inactive_user' ||
    message === 'username_required' ||
    message === 'password_or_pin_required'
  ) {
    return message
  }
  return 'unknown'
}

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [secret, setSecret] = useState('')
  const [mode, setMode] = useState<'password' | 'pin'>('password')
  const [busy, setBusy] = useState(false)
  const [errorKey, setErrorKey] = useState<string | null>(null)

  return (
    <div className="login-page">
      <form
        className="login-card"
        onSubmit={(e) => {
          e.preventDefault()
          void (async () => {
            setBusy(true)
            setErrorKey(null)
            const r =
              mode === 'password'
                ? await login({ username, password: secret })
                : await login({ username, pin: secret })
            setBusy(false)
            if (!r.ok) {
              setErrorKey(mapLoginError(r.message))
              return
            }
            navigate('/dashboard', { replace: true })
          })()
        }}
      >
        <h1 className="login-card__title">{t('auth.login.title')}</h1>
        <p className="login-card__intro">{t('auth.login.intro')}</p>

        <label className="login-field">
          <span>{t('auth.login.username')}</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </label>

        <div className="login-mode">
          <button
            type="button"
            className={mode === 'password' ? 'login-mode__btn login-mode__btn--active' : 'login-mode__btn'}
            onClick={() => setMode('password')}
          >
            {t('auth.login.usePassword')}
          </button>
          <button
            type="button"
            className={mode === 'pin' ? 'login-mode__btn login-mode__btn--active' : 'login-mode__btn'}
            onClick={() => setMode('pin')}
          >
            {t('auth.login.usePin')}
          </button>
        </div>

        <label className="login-field">
          <span>{mode === 'password' ? t('auth.login.password') : t('auth.login.pin')}</span>
          <input
            type={mode === 'password' ? 'password' : 'text'}
            inputMode={mode === 'pin' ? 'numeric' : undefined}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoComplete={mode === 'password' ? 'current-password' : 'one-time-code'}
          />
        </label>

        {errorKey ? <p className="login-card__error">{t(`auth.login.errors.${errorKey}`)}</p> : null}

        <button type="submit" className="login-card__submit" disabled={busy}>
          {busy ? t('auth.login.loading') : t('auth.login.submit')}
        </button>
      </form>
    </div>
  )
}
