import { Navigate } from 'react-router-dom'
import { Result, Spin } from 'antd'
import { ROLES } from '../constants/roles.js'
import { ROUTES } from '../constants/routes.js'
import { useAuth } from '../hooks/useAuth.js'

export default function RoleRedirect() {
  const { authError, isAuthenticated, loading, profile, role } = useAuth()

  if (loading) {
    return (
      <div className="screen-center">
        <Spin size="large" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to={ROUTES.login} replace />
  if (authError || !profile) return <Navigate to={ROUTES.unauthorized} replace />
  if (profile.status !== 'active') {
    return (
      <div className="screen-center">
        <Result
          status="warning"
          title="Account not active"
          subTitle="Please contact a manager before using attendance features."
        />
      </div>
    )
  }

  if (role === ROLES.manager) return <Navigate to={ROUTES.managerDashboard} replace />
  if (role === ROLES.staff) return <Navigate to={ROUTES.staffHome} replace />

  return <Navigate to={ROUTES.unauthorized} replace />
}
