import { Navigate, useLocation } from 'react-router-dom'
import { Result, Spin } from 'antd'
import { useAuth } from '../context/AuthContext.js'

// Wrap a page with this to require login, and optionally a specific role:
//   <ProtectedRoute roles={['SUPER_ADMIN']}><AdminDashboard /></ProtectedRoute>
export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <Spin fullscreen />
  }

  if (!user) {
    // Remember where they were going, so login can send them back there
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Still on an admin-set password: choose their own before anything else
  if (user.mustChangePassword) {
    return <Navigate to="/change-password" replace />
  }

  if (roles && !roles.includes(user.role)) {
    return <Result status="403" title="Not allowed" subTitle="Your role can't open this page." />
  }

  return children
}
