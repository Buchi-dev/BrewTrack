import { App as AntApp } from 'antd'
import { AuthProvider } from '../features/auth/AuthProvider.jsx'
import AppRouter from '../router/AppRouter.jsx'

function AppRoot() {
  return (
    <AntApp>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </AntApp>
  )
}

export default AppRoot
