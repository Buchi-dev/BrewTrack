import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Button, Result, Spin } from 'antd'
import { Link } from 'react-router-dom'
import { ROUTES } from '../constants/routes.js'
import { useAuth } from '../hooks/useAuth.js'

export default function ProtectedRoute({ allowedRoles }) {
  const location = useLocation()
  const { authError, isAuthenticated, loading, profile, role } = useAuth()

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

  if (authError) {
    return (
      <div className="screen-center">
        <Result
          status="error"
          title="Could not load your account"
          subTitle="Please refresh the page or sign in again."
        />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="screen-center">
        <Result
          status="warning"
          title="Profile setup required"
          subTitle="Your login exists, but no active staff profile is connected to it yet."
          extra={
            <Link to={ROUTES.login}>
              <Button type="primary">Back to sign in</Button>
            </Link>
          }
        />
      </div>
    )
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
