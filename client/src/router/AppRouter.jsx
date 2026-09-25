import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ROLES } from '../constants/roles.js'
import { ROUTES } from '../constants/routes.js'
import LoginPage from '../features/auth/LoginPage.jsx'
import ResetPasswordPage from '../features/auth/ResetPasswordPage.jsx'
import AppLayout from '../layouts/AppLayout.jsx'
import AuthLayout from '../layouts/AuthLayout.jsx'
import ManagerAttendancePage from '../pages/manager/ManagerAttendancePage.jsx'
import ManagerBranchesPage from '../pages/manager/ManagerBranchesPage.jsx'
import ManagerDashboardPage from '../pages/manager/ManagerDashboardPage.jsx'
import ManagerEmployeesPage from '../pages/manager/ManagerEmployeesPage.jsx'
import ManagerReportsPage from '../pages/manager/ManagerReportsPage.jsx'
import ManagerSettingsPage from '../pages/manager/ManagerSettingsPage.jsx'
import NotFoundPage from '../pages/shared/NotFoundPage.jsx'
import UnauthorizedPage from '../pages/shared/UnauthorizedPage.jsx'
import StaffAttendancePage from '../pages/staff/StaffAttendancePage.jsx'
import StaffHistoryPage from '../pages/staff/StaffHistoryPage.jsx'
import StaffHomePage from '../pages/staff/StaffHomePage.jsx'
import StaffProfilePage from '../pages/staff/StaffProfilePage.jsx'
import ProtectedRoute from './ProtectedRoute.jsx'
import RoleRedirect from './RoleRedirect.jsx'

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path={ROUTES.login} element={<LoginPage />} />
          <Route path={ROUTES.resetPassword} element={<ResetPasswordPage />} />
        </Route>

        <Route path={ROUTES.unauthorized} element={<UnauthorizedPage />} />
        <Route path="/" element={<RoleRedirect />} />

        <Route element={<ProtectedRoute allowedRoles={[ROLES.staff]} />}>
          <Route element={<AppLayout section="staff" />}>
            <Route path={ROUTES.staffHome} element={<StaffHomePage />} />
            <Route path={ROUTES.staffAttendance} element={<StaffAttendancePage />} />
            <Route path={ROUTES.staffHistory} element={<StaffHistoryPage />} />
            <Route path={ROUTES.staffProfile} element={<StaffProfilePage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={[ROLES.manager]} />}>
          <Route element={<AppLayout section="manager" />}>
            <Route path={ROUTES.managerDashboard} element={<ManagerDashboardPage />} />
            <Route path={ROUTES.managerAttendance} element={<ManagerAttendancePage />} />
            <Route path={ROUTES.managerEmployees} element={<ManagerEmployeesPage />} />
            <Route path={ROUTES.managerBranches} element={<ManagerBranchesPage />} />
            <Route path={ROUTES.managerReports} element={<ManagerReportsPage />} />
            <Route path={ROUTES.managerSettings} element={<ManagerSettingsPage />} />
          </Route>
        </Route>

        <Route path="/staff/*" element={<Navigate to={ROUTES.staffHome} replace />} />
        <Route path="/manager/*" element={<Navigate to={ROUTES.managerDashboard} replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
