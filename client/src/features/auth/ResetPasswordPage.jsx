import { MailOutlined } from '@ant-design/icons'
import { Button, Form, Input, Result, Typography, message } from 'antd'
import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes.js'
import { useAuth } from '../../hooks/useAuth.js'
import { requestPasswordReset } from '../../services/authService.js'

const { Text, Title } = Typography

export default function ResetPasswordPage() {
  const { isConfigured } = useAuth()
  const [api, contextHolder] = message.useMessage()

  async function handleFinish({ email }) {
    try {
      await requestPasswordReset(email)
      api.success('Password reset instructions sent.')
    } catch (error) {
      api.error(error.message)
    }
  }

  return (
    <div className="auth-card">
      {contextHolder}
      <Title level={2}>Reset password</Title>
      <Text type="secondary">We will send reset instructions to your email address.</Text>

      {!isConfigured ? (
        <Result
          status="warning"
          title="Supabase is not configured"
          extra={<Link to={ROUTES.login}>Back to sign in</Link>}
        />
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
