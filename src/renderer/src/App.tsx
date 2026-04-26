import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { ReactElement } from 'react'
import { AppSettingsProvider } from './contexts/AppSettingsContext'
import { ActivationGate } from './components/ActivationGate'
import { AppLayout } from './layout/AppLayout'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { PosPage } from './pages/pos/PosPage'
import { ProductsPage } from './pages/products/ProductsPage'
import { DebtsPage } from './pages/debts/DebtsPage'
import { SuppliersPage } from './pages/suppliers/SuppliersPage'
import { ExpensesPage } from './pages/expenses/ExpensesPage'
import { CashflowPage } from './pages/cashflow/CashflowPage'
import { ReportsPage } from './pages/reports/ReportsPage'
import { SettingsPage } from './pages/settings/SettingsPage'
import { EmployeesPage } from './pages/employees/EmployeesPage'
import { LoginPage } from './pages/auth/LoginPage'
import { DevPage } from './pages/dev/DevPage'
import type { PermissionModule } from '../../shared/ipc/types'

function ProtectedModule({ moduleKey, children }: { moduleKey: PermissionModule; children: ReactElement }) {
  const { loaded, session, hasPermission } = useAuth()
  if (!loaded) {
    return null
  }
  if (!session) {
    return <Navigate to="/login" replace />
  }
  if (!hasPermission(moduleKey)) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

function ProtectedAppLayout() {
  const { loaded, session } = useAuth()
  if (!loaded) {
    return null
  }
  if (!session) {
    return <Navigate to="/login" replace />
  }
  return <AppLayout />
}

export default function App() {
  return (
    <ActivationGate>
      <AuthProvider>
        <AppSettingsProvider>
          <HashRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<ProtectedAppLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<ProtectedModule moduleKey="dashboard"><DashboardPage /></ProtectedModule>} />
                <Route path="pos" element={<ProtectedModule moduleKey="pos"><PosPage /></ProtectedModule>} />
                <Route path="products" element={<ProtectedModule moduleKey="products"><ProductsPage /></ProtectedModule>} />
                <Route path="debts" element={<ProtectedModule moduleKey="debts"><DebtsPage /></ProtectedModule>} />
                <Route path="suppliers" element={<ProtectedModule moduleKey="suppliers"><SuppliersPage /></ProtectedModule>} />
                <Route path="expenses" element={<ProtectedModule moduleKey="expenses"><ExpensesPage /></ProtectedModule>} />
                <Route path="cashflow" element={<ProtectedModule moduleKey="cashflow"><CashflowPage /></ProtectedModule>} />
                <Route path="reports" element={<ProtectedModule moduleKey="reports"><ReportsPage /></ProtectedModule>} />
                <Route path="settings" element={<ProtectedModule moduleKey="settings"><SettingsPage /></ProtectedModule>} />
                <Route path="employees" element={<ProtectedModule moduleKey="employees"><EmployeesPage /></ProtectedModule>} />
                <Route path="dev" element={<ProtectedModule moduleKey="devTools"><DevPage /></ProtectedModule>} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Routes>
          </HashRouter>
        </AppSettingsProvider>
      </AuthProvider>
    </ActivationGate>
  )
}
