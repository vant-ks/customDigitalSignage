import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import DashboardShell from './components/layout/DashboardShell'
import DisplaysPage from './pages/DisplaysPage'
import LoginPage from './pages/LoginPage'

function PrivateRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<PrivateRoute />}>
        <Route element={<DashboardShell />}>
          <Route index element={<Navigate to="/displays" replace />} />
          <Route path="/displays" element={<DisplaysPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
