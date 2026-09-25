import { Navigate } from 'react-router-dom'
import { ROLES } from '../constants/roles.js'
import { ROUTES } from '../constants/routes.js'
import { useAuth } from '../hooks/useAuth.js'

export default function RoleRedirect() {
  const { isAuthenticated, role } = useAuth()

  if (!isAuthenticated) return <Navigate to={ROUTES.login} replace />
  if (role === ROLES.manager) return <Navigate to={ROUTES.managerDashboard} replace />

  return <Navigate to={ROUTES.staffHome} replace />
}
