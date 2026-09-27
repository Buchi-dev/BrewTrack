import { LogoutOutlined } from '@ant-design/icons'
import { App, Button, Result } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../../constants/routes.js'
import { signOut } from '../../services/authService.js'

export default function AccountInactiveResult() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)

    try {
      await signOut()
      navigate(ROUTES.login, { replace: true })
    } catch (error) {
      message.error(error.message || 'Unable to log out.')
      setSigningOut(false)
    }
  }

  return (
    <Result
      status="warning"
      title="Account not active"
      subTitle="Please contact a manager before using attendance features."
      extra={
        <Button type="primary" icon={<LogoutOutlined />} loading={signingOut} onClick={handleSignOut}>
          Log out
        </Button>
      }
    />
  )
}
