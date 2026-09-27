import {
  CameraOutlined,
  CloseOutlined,
  DownloadOutlined,
  LockOutlined,
  MailOutlined,
  MobileOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { Alert, Button, Checkbox, Form, Input, Modal, Spin, Typography, message } from 'antd'
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { BRAND } from '../../constants/brand.js'
import { ROUTES } from '../../constants/routes.js'
import { useAuth } from '../../hooks/useAuth.js'
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js'
import { usePWAInstall } from '../../hooks/usePWAInstall.js'
import { signInWithPassword } from '../../services/authService.js'
import { getFriendlyAuthError } from './authMessages.js'

const { Text, Title } = Typography

function MobileLoginHeader() {
  return (
    <div className="mobile-login-header">
      <img className="mobile-login-logo" src={BRAND.logos.icon} alt={BRAND.shortName} />
      <Text className="eyebrow">{BRAND.appName}</Text>
      <Text className="mobile-login-message">
        Clock in with a fresh selfie. Secure and audit-ready.
      </Text>
    </div>
  )
}

function InstallAppPrompt() {
  const {
    canInstall,
    canShowIOSInstructions,
    dismissInstall,
    install,
  } = usePWAInstall()
  const [instructionsOpen, setInstructionsOpen] = useState(false)

  if (!canInstall && !canShowIOSInstructions) return null

  return (
    <>
      <div className="install-card">
        <div>
          <Text strong>Install BigBrew Attendance</Text>
          <Text type="secondary">Get faster access from your home screen.</Text>
        </div>
        <div className="install-card-actions">
          {canInstall ? (
            <Button size="small" type="primary" icon={<DownloadOutlined />} onClick={install}>
              Install
            </Button>
          ) : (
            <Button size="small" type="primary" icon={<MobileOutlined />} onClick={() => setInstructionsOpen(true)}>
              How to install
            </Button>
          )}
          <Button
            size="small"
            type="text"
            aria-label="Dismiss install prompt"
            icon={<CloseOutlined />}
            onClick={dismissInstall}
          />
        </div>
      </div>

      <Modal
        open={instructionsOpen}
        title="Add to Home Screen"
        footer={<Button type="primary" onClick={() => setInstructionsOpen(false)}>Done</Button>}
        onCancel={() => setInstructionsOpen(false)}
        className="ios-install-modal"
      >
        <ol className="ios-install-steps">
          <li>Tap the Share button in Safari.</li>
          <li>Choose Add to Home Screen.</li>
          <li>Tap Add.</li>
        </ol>
      </Modal>
    </>
  )
}

function LoginForm({ errorMessage, isConfigured, isOffline, onFinish, submitting }) {
  return (
    <>
      {!isConfigured && (
        <Alert
          type="warning"
          showIcon
          message="Supabase is not configured yet"
          description="Create client/.env from .env.example before signing in."
        />
      )}

      {isOffline && (
        <Alert
          type="warning"
          showIcon
          message="You're offline. Sign-in requires a connection."
        />
      )}

      {errorMessage && (
        <Alert
          type="error"
          showIcon
          message={errorMessage}
          role="alert"
          aria-live="polite"
        />
      )}

      <Form layout="vertical" requiredMark={false} onFinish={onFinish} className="auth-form">
        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: 'Enter your email.' },
            { type: 'email', message: 'Enter a valid email address.' },
          ]}
        >
          <Input
            prefix={<MailOutlined />}
            type="email"
            autoComplete="username"
            inputMode="email"
            size="large"
          />
        </Form.Item>

        <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Enter your password.' }]}>
          <Input.Password
            prefix={<LockOutlined />}
            autoComplete="current-password"
            size="large"
            visibilityToggle
          />
        </Form.Item>

        <div className="mobile-login-row">
          <Form.Item name="remember" valuePropName="checked" noStyle initialValue>
            <Checkbox>Remember me</Checkbox>
          </Form.Item>
          <Link to={ROUTES.resetPassword}>Forgot password?</Link>
        </div>

        <Form.Item shouldUpdate className="auth-submit-item">
          {() => (
            <Button
              htmlType="submit"
              type="primary"
              size="large"
              block
              disabled={!isConfigured || isOffline || submitting}
              loading={submitting}
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </Button>
          )}
        </Form.Item>
      </Form>
    </>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, isConfigured, loading } = useAuth()
  const isOnline = useOnlineStatus()
  const [api, contextHolder] = message.useMessage()
  const [errorMessage, setErrorMessage] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const from = location.state?.from?.pathname || '/'

  if (loading) {
    return (
      <div className="screen-center compact">
        <Spin size="large" />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  async function handleFinish(values) {
    setErrorMessage(null)
    setSubmitting(true)

    try {
      await signInWithPassword(values)
      navigate(from, { replace: true })
    } catch (error) {
      const friendlyMessage = getFriendlyAuthError(error, 'Unable to sign in. Check your details and try again.')
      setErrorMessage(friendlyMessage)
      api.error(friendlyMessage)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-card">
      {contextHolder}
      <MobileLoginHeader />
      <InstallAppPrompt />

      <div className="auth-card-heading">
        <Title level={2}>Sign in</Title>
        <Text type="secondary">Use your company email and password.</Text>
      </div>

      <LoginForm
        errorMessage={errorMessage}
        isConfigured={isConfigured}
        isOffline={!isOnline}
        onFinish={handleFinish}
        submitting={submitting}
      />

      <div className="mobile-trust-row" aria-label="Attendance app features">
        <span><CameraOutlined /> Fresh selfie</span>
        <span><SafetyCertificateOutlined /> Secure records</span>
        <span><MobileOutlined /> Home screen ready</span>
      </div>
    </div>
  )
}
