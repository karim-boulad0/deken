import { BarChart3, Settings, Wallet } from 'lucide-react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './layout/AppLayout'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { PosPage } from './pages/pos/PosPage'
import { ProductsPage } from './pages/products/ProductsPage'
import { PlaceholderPage } from './pages/PlaceholderPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="pos" element={<PosPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route
            path="debts"
            element={
              <PlaceholderPage
                titleKey="pages.debtsTitle"
                hintKey="pages.debtsHint"
                Icon={Wallet}
              />
            }
          />
          <Route
            path="reports"
            element={
              <PlaceholderPage
                titleKey="pages.reportsTitle"
                hintKey="pages.reportsHint"
                Icon={BarChart3}
              />
            }
          />
          <Route
            path="settings"
            element={
              <PlaceholderPage
                titleKey="pages.settingsTitle"
                hintKey="pages.settingsHint"
                Icon={Settings}
              />
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
