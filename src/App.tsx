import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import DashboardShell from './components/layout/DashboardShell'
import DisplaysPage from './pages/DisplaysPage'
import LoginPage from './pages/LoginPage'
import MediaPage from './pages/MediaPage'
import PlaylistBuilderPage from './pages/PlaylistBuilderPage'

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
          <Route path="/media" element={<MediaPage />} />
          <Route path="/playlists" element={<PlaylistBuilderPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
