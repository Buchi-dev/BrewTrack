import { LockOutlined, MailOutlined } from '@ant-design/icons'
import { Alert, Button, Form, Input, Result, Spin, Typography, message } from 'antd'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ROUTES } from '../../constants/routes.js'
import { useAuth } from '../../hooks/useAuth.js'
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js'
import { requestPasswordReset, signOut, updatePassword } from '../../services/authService.js'
import { getFriendlyAuthError } from './authMessages.js'

const { Text, Title } = Typography

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const { isAuthenticated, isConfigured, loading } = useAuth()
  const isOnline = useOnlineStatus()
  const [api, contextHolder] = message.useMessage()
  const [sendingReset, setSendingReset] = useState(false)
  const [updatingPassword, setUpdatingPassword] = useState(false)

  async function handleFinish({ email }) {
    setSendingReset(true)
    try {
      await requestPasswordReset(email)
      api.success('Password reset instructions sent.')
    } catch (error) {
      api.error(getFriendlyAuthError(error, 'Unable to send reset instructions. Please try again.'))
    } finally {
      setSendingReset(false)
    }
  }

  async function handlePasswordUpdate({ password }) {
    setUpdatingPassword(true)
    try {
      await updatePassword(password)
      api.success('Password updated. Please sign in with your new password.')
      await signOut()
      navigate(ROUTES.login, { replace: true })
    } catch (error) {
      api.error(getFriendlyAuthError(error, 'Unable to update password. Please try again.'))
    } finally {
      setUpdatingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="screen-center compact">
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="auth-card">
      {contextHolder}
      <Title level={2}>{isAuthenticated ? 'Set new password' : 'Reset password'}</Title>
      <Text type="secondary">
        {isAuthenticated
          ? 'Enter a new password for your attendance account.'
          : 'We will send reset instructions to your email address.'}
      </Text>

      {!isOnline && (
        <Alert
          type="warning"
          showIcon
          message="You're offline. Password reset needs an internet connection."
        />
      )}

      {!isConfigured ? (
        <Result
          status="warning"
          title="Supabase is not configured"
          extra={<Link to={ROUTES.login}>Back to sign in</Link>}
        />
      ) : isAuthenticated ? (
        <Form layout="vertical" requiredMark={false} onFinish={handlePasswordUpdate} className="auth-form">
          <Form.Item
            name="password"
            label="New password"
            rules={[
              { required: true, message: 'Enter a new password.' },
              { min: 8, message: 'Use at least 8 characters.' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              autoComplete="new-password"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Confirm password"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Confirm your new password.' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve()
                  }

                  return Promise.reject(new Error('Passwords do not match.'))
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              autoComplete="new-password"
              size="large"
            />
          </Form.Item>

          <Button
            htmlType="submit"
            type="primary"
            size="large"
            block
            disabled={!isOnline || updatingPassword}
            loading={updatingPassword}
          >
            {updatingPassword ? 'Updating...' : 'Update password'}
          </Button>
        </Form>
      ) : (
        <Form layout="vertical" requiredMark={false} onFinish={handleFinish} className="auth-form">
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Enter your email.' },
              { type: 'email', message: 'Enter a valid email address.' },
            ]}
          >
            <Input prefix={<MailOutlined />} type="email" autoComplete="email" size="large" />
          </Form.Item>
          <Button
            htmlType="submit"
            type="primary"
            size="large"
            block
            disabled={!isOnline || sendingReset}
            loading={sendingReset}
          >
            {sendingReset ? 'Sending...' : 'Send reset link'}
          </Button>
          <Link to={ROUTES.login}>Back to sign in</Link>
        </Form>
      )}
    </div>
  )
}
