import {
  type LucideIcon,
  BarChart3,
  LayoutDashboard,
  Package,
  ScanBarcode,
  Settings,
  Wallet,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const routes: readonly { to: string; labelKey: string; Icon: LucideIcon }[] = [
  { to: '/dashboard', labelKey: 'nav.dashboard', Icon: LayoutDashboard },
  { to: '/pos', labelKey: 'nav.pos', Icon: ScanBarcode },
  { to: '/products', labelKey: 'nav.products', Icon: Package },
  { to: '/debts', labelKey: 'nav.debts', Icon: Wallet },
  { to: '/reports', labelKey: 'nav.reports', Icon: BarChart3 },
  { to: '/settings', labelKey: 'nav.settings', Icon: Settings },
]

export type SidebarNavLayout = 'sidebar' | 'top'

type Props = {
  /** When `top`, links render in a horizontal row (used with top app bar). Default: sidebar. */
  layout?: SidebarNavLayout
}

export function SidebarNav({ layout = 'sidebar' }: Props) {
  const { t } = useTranslation()
  const isTop = layout === 'top'
  const rootClass = isTop ? 'sidebar-nav sidebar-nav--top' : 'sidebar-nav'

  return (
    <nav className={rootClass} aria-label={t('nav.ariaPrimary')}>
      <ul className="sidebar-nav__list">
        {routes.map(({ to, labelKey, Icon }) => (
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
