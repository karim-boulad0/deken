import { Outlet, useLocation } from 'react-router-dom'
import { Store } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { SidebarNav } from './SidebarNav'
import './AppLayout.css'

export function AppLayout() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const isPosRoute = pathname === '/pos'

  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <div className="app-shell__brand">
          <div className="app-shell__brand-mark" aria-hidden>
            <Store className="app-shell__brand-icon" strokeWidth={2} size={22} />
          </div>
          <div className="app-shell__brand-text">
            <span className="app-shell__brand-name">{t('app.name')}</span>
            <span className="app-shell__brand-tag">{t('app.tagline')}</span>
          </div>
        </div>
        <SidebarNav />
      </aside>
      <div className="app-shell__column">
        <header className="app-shell__header">
          <LanguageSwitcher />
        </header>
        <main className={`app-shell__content${isPosRoute ? ' app-shell__content--pos' : ''}`}>
          <div className={`app-shell__page${isPosRoute ? ' app-shell__page--pos' : ''}`}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
