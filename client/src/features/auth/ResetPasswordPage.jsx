import { LockOutlined, MailOutlined } from '@ant-design/icons'
import { Button, Form, Input, Result, Spin, Typography, message } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { ROUTES } from '../../constants/routes.js'
import { useAuth } from '../../hooks/useAuth.js'
import { requestPasswordReset, signOut, updatePassword } from '../../services/authService.js'

const { Text, Title } = Typography

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const { isAuthenticated, isConfigured, loading } = useAuth()
  const [api, contextHolder] = message.useMessage()

  async function handleFinish({ email }) {
    try {
      await requestPasswordReset(email)
      api.success('Password reset instructions sent.')
    } catch (error) {
      api.error(error.message)
    }
  }

  async function handlePasswordUpdate({ password }) {
    try {
      await updatePassword(password)
      api.success('Password updated. Please sign in with your new password.')
      await signOut()
      navigate(ROUTES.login, { replace: true })
    } catch (error) {
      api.error(error.message)
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

          <Button htmlType="submit" type="primary" size="large" block>
            Update password
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
          <Button htmlType="submit" type="primary" size="large" block>
            Send reset link
          </Button>
          <Link to={ROUTES.login}>Back to sign in</Link>
        </Form>
      )}
    </div>
  )
}
