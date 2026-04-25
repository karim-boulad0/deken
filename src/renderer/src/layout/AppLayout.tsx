import { Outlet, useLocation } from 'react-router-dom'
import { Store } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { setAppLanguage, type SupportedLng } from '../i18n'
import { useAppSettings } from '../contexts/AppSettingsContext'
import { useAuth } from '../contexts/AuthContext'
import { SidebarNav } from './SidebarNav'
import './AppLayout.css'

export function AppLayout() {
  const { t, i18n } = useTranslation()
  const { settings } = useAppSettings()
  const { session, logout } = useAuth()
  const { pathname } = useLocation()
  const isPosRoute = pathname === '/pos'
  const isDashboard = pathname === '/dashboard' || pathname === '/'
  const brand = settings.shopName.trim() || t('app.defaultBusinessName')
  const isTopNav = settings.navLayout === 'top'
  const currentLng: SupportedLng = i18n.language.startsWith('ar') ? 'ar' : 'en'
  const uiDir = i18n.dir()

  return (
    <div className={`app-shell${isTopNav ? ' app-shell--top' : ''}`}>
      {isTopNav ? (
        <header className="app-shell__topbar">
          <div className="app-shell__topbar-grid">
            <div className="app-shell__brand app-shell__brand--top" dir="auto">
              <div className="app-shell__brand-mark" aria-hidden>
                <Store className="app-shell__brand-icon" strokeWidth={2} size={22} />
              </div>
              <div className="app-shell__brand-text">
                <span className="app-shell__brand-name" title={brand}>
                  {brand}
                </span>
              </div>
            </div>
            <div className="app-shell__topbar-nav" dir="auto">
              <SidebarNav layout="top" />
            </div>
            <div className="app-shell__topbar-tools" dir={uiDir}>
              <details className="top-user-menu">
                <summary className="top-user-menu__summary">
                  {session?.user.username ?? 'user'}
                </summary>
                <div className="top-user-menu__panel">
                  <div className="top-user-menu__lang" role="group" aria-label={t('lang.aria')}>
                    <button
                      type="button"
                      className={currentLng === 'en' ? 'top-user-menu__lang-btn top-user-menu__lang-btn--active' : 'top-user-menu__lang-btn'}
                      onClick={() => setAppLanguage('en')}
                    >
                      EN
                    </button>
                    <button
                      type="button"
                      className={currentLng === 'ar' ? 'top-user-menu__lang-btn top-user-menu__lang-btn--active' : 'top-user-menu__lang-btn'}
                      onClick={() => setAppLanguage('ar')}
                    >
                      AR
                    </button>
                  </div>
                  <button type="button" className="top-user-menu__logout" onClick={() => void logout()}>
                    {t('auth.logout')}
                  </button>
                </div>
              </details>
            </div>
          </div>
        </header>
      ) : (
        <aside className="app-shell__sidebar">
          <div className="app-shell__brand">
            <div className="app-shell__brand-mark" aria-hidden>
              <Store className="app-shell__brand-icon" strokeWidth={2} size={22} />
            </div>
            <div className="app-shell__brand-text">
              <span className="app-shell__brand-name" title={brand}>
                {brand}
              </span>
            </div>
          </div>
          <SidebarNav layout="sidebar" />
          <div className="app-shell__sidebar-tools" dir="auto">
            <button type="button" className="app-shell__logout-btn" onClick={() => void logout()}>
              {t('auth.logout')}
            </button>
            <LanguageSwitcher />
          </div>
        </aside>
      )}
      <div className="app-shell__column">
        <main className={`app-shell__content${isPosRoute ? ' app-shell__content--pos' : ''}`}>
          <div
            className={`app-shell__page${isPosRoute ? ' app-shell__page--pos' : ''}${
              isDashboard ? ' app-shell__page--dashboard' : ''
            }`}
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
