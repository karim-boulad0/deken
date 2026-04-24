import { BarChart3, LayoutDashboard, Package, ScanBarcode, Settings, Wallet } from 'lucide-react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './layout/AppLayout'
import { PlaceholderPage } from './pages/PlaceholderPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route
            path="dashboard"
            element={
              <PlaceholderPage
                titleKey="pages.dashboardTitle"
                hintKey="pages.dashboardHint"
                Icon={LayoutDashboard}
              />
            }
          />
          <Route
            path="pos"
            element={
              <PlaceholderPage
                titleKey="pages.posTitle"
                hintKey="pages.posHint"
                Icon={ScanBarcode}
              />
            }
          />
          <Route
            path="products"
            element={
              <PlaceholderPage
                titleKey="pages.productsTitle"
                hintKey="pages.productsHint"
                Icon={Package}
              />
            }
          />
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
