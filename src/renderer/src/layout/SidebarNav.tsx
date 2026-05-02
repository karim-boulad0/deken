import {
  type LucideIcon,
  BarChart3,
  History,
  LayoutDashboard,
  Package,
  Receipt,
  ScanBarcode,
  Settings,
  Truck,
  Wallet,
  Wrench,
  Banknote,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAppSettings } from '../contexts/AppSettingsContext'
import type { PermissionModule } from '../../../shared/ipc/types'

const routes: readonly { to: string; moduleKey: PermissionModule; labelKey: string; Icon: LucideIcon }[] = [
  { to: '/dashboard', moduleKey: 'dashboard', labelKey: 'nav.dashboard', Icon: LayoutDashboard },
  { to: '/pos', moduleKey: 'pos', labelKey: 'nav.pos', Icon: ScanBarcode },
  { to: '/products', moduleKey: 'products', labelKey: 'nav.products', Icon: Package },
  { to: '/debts', moduleKey: 'debts', labelKey: 'nav.debts', Icon: Wallet },
  { to: '/suppliers', moduleKey: 'suppliers', labelKey: 'nav.suppliers', Icon: Truck },
  { to: '/expenses', moduleKey: 'expenses', labelKey: 'nav.expenses', Icon: Receipt },
  { to: '/cashflow', moduleKey: 'cashflow', labelKey: 'nav.cashflow', Icon: History },
  { to: '/reports', moduleKey: 'reports', labelKey: 'nav.reports', Icon: BarChart3 },
  { to: '/settings', moduleKey: 'settings', labelKey: 'nav.settings', Icon: Settings },
  { to: '/employees', moduleKey: 'employees', labelKey: 'nav.employees', Icon: Users },
  { to: '/wallet', moduleKey: 'wallet', labelKey: 'nav.wallet', Icon: Banknote },
  { to: '/dev', moduleKey: 'devTools', labelKey: 'nav.devTools', Icon: Wrench },
]

export type SidebarNavLayout = 'sidebar' | 'top'

type Props = {
  /** When `top`, links render in a horizontal row (used with top app bar). Default: sidebar. */
  layout?: SidebarNavLayout
}

export function SidebarNav({ layout = 'sidebar' }: Props) {
  const { t } = useTranslation()
  const { hasPermission } = useAuth()
  const { settings } = useAppSettings()
  const isTop = layout === 'top'
  const rootClass = isTop ? 'sidebar-nav sidebar-nav--top' : 'sidebar-nav'

  return (
    <nav className={rootClass} aria-label={t('nav.ariaPrimary')}>
      <ul className="sidebar-nav__list">
        {routes
          .filter((route) => {
            if (route.moduleKey === 'devTools' && !settings.showDevTools) return false
            return hasPermission(route.moduleKey)
          })
          .map(({ to, labelKey, Icon }) => (
          <li key={to} className="sidebar-nav__item">
            <NavLink
              to={to}
              className={({ isActive }) =>
                `sidebar-nav__link${isActive ? ' sidebar-nav__link--active' : ''}`
              }
            >
              <span className="sidebar-nav__icon" aria-hidden>
                <Icon size={18} strokeWidth={2} />
              </span>
              <span className="sidebar-nav__label">{t(labelKey)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
