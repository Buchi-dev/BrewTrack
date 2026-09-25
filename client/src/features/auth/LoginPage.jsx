import { LockOutlined, MailOutlined } from '@ant-design/icons'
import { Alert, Button, Form, Input, Typography, message } from 'antd'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ROUTES } from '../../constants/routes.js'
import { useAuth } from '../../hooks/useAuth.js'
import { signInWithPassword } from '../../services/authService.js'

const { Text, Title } = Typography

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isConfigured } = useAuth()
  const [api, contextHolder] = message.useMessage()
  const from = location.state?.from?.pathname || '/'

  async function handleFinish(values) {
    try {
      await signInWithPassword(values)
      navigate(from, { replace: true })
    } catch (error) {
      api.error(error.message)
    }
  }

  return (
    <div className="auth-card">
      {contextHolder}
      <Title level={2}>Sign in</Title>
      <Text type="secondary">Use your company email and password.</Text>

      {!isConfigured && (
        <Alert
          type="warning"
          showIcon
          message="Supabase is not configured yet"
          description="Create client/.env from .env.example before signing in."
        />
      )}

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

        <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Enter your password.' }]}>
          <Input.Password
            prefix={<LockOutlined />}
            autoComplete="current-password"
            size="large"
          />
        </Form.Item>

        <Button htmlType="submit" type="primary" size="large" block disabled={!isConfigured}>
          Sign in
        </Button>
      </Form>

      <Link to={ROUTES.resetPassword}>Forgot password?</Link>
    </div>
  )
}
