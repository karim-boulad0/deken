import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppSettingsProvider } from './contexts/AppSettingsContext'
import { AppLayout } from './layout/AppLayout'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { PosPage } from './pages/pos/PosPage'
import { ProductsPage } from './pages/products/ProductsPage'
import { DebtsPage } from './pages/debts/DebtsPage'
import { SuppliersPage } from './pages/suppliers/SuppliersPage'
import { ExpensesPage } from './pages/expenses/ExpensesPage'
import { CashflowPage } from './pages/cashflow/CashflowPage'
import { ReportsPage } from './pages/reports/ReportsPage'
import { SettingsPage } from './pages/settings/SettingsPage'

export default function App() {
  return (
    <AppSettingsProvider>
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="pos" element={<PosPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="debts" element={<DebtsPage />} />
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="cashflow" element={<CashflowPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </HashRouter>
    </AppSettingsProvider>
  )
}
