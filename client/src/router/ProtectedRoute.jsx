import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Result, Spin } from 'antd'
import { ROUTES } from '../constants/routes.js'
import { useAuth } from '../hooks/useAuth.js'

export default function ProtectedRoute({ allowedRoles }) {
  const location = useLocation()
  const { isAuthenticated, loading, profile, role } = useAuth()

  if (loading) {
    return (
      <div className="screen-center">
        <Spin size="large" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.login} replace state={{ from: location }} />
  }

  if (profile?.status && profile.status !== 'active') {
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

  if (allowedRoles?.length && !allowedRoles.includes(role)) {
    return <Navigate to={ROUTES.unauthorized} replace />
  }

  return <Outlet />
}
