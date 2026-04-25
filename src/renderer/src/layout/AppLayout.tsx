import { Outlet, useLocation } from 'react-router-dom'
import { Store } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { useAppSettings } from '../contexts/AppSettingsContext'
import { SidebarNav } from './SidebarNav'
import './AppLayout.css'

export function AppLayout() {
  const { t } = useTranslation()
  const { settings } = useAppSettings()
  const { pathname } = useLocation()
  const isPosRoute = pathname === '/pos'
  const isDashboard = pathname === '/dashboard' || pathname === '/'
  const brand = settings.shopName.trim() || t('app.name')
  const isTopNav = settings.navLayout === 'top'

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
                <span className="app-shell__brand-tag app-shell__brand-tag--topbar">
                  {t('app.tagline')}
                </span>
              </div>
            </div>
            <div className="app-shell__topbar-nav" dir="auto">
              <SidebarNav layout="top" />
            </div>
            <div className="app-shell__topbar-tools" dir="auto">
              <LanguageSwitcher />
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
              <span className="app-shell__brand-tag">{t('app.tagline')}</span>
            </div>
          </div>
          <SidebarNav layout="sidebar" />
        </aside>
      )}
      <div className="app-shell__column">
        {!isTopNav ? (
          <header className="app-shell__header">
            <LanguageSwitcher />
          </header>
        ) : null}
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
