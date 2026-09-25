import { Outlet } from 'react-router-dom'
import { Typography } from 'antd'
import { BRAND } from '../constants/brand.js'

const { Text, Title } = Typography

export default function AuthLayout() {
  return (
    <main className="auth-layout">
      <section className="auth-brand">
        <img className="auth-brand-logo" src={BRAND.logos.icon} alt={BRAND.shortName} />
        <Text className="eyebrow">{BRAND.appName}</Text>
        <Title level={1}>Selfie attendance with records managers can actually audit.</Title>
        <Text>
          Staff clock in and out with a fresh camera selfie. Managers get searchable attendance,
          branch context, and a secure trail of evidence.
        </Text>
      </section>
      <section className="auth-panel">
        <Outlet />
      </section>
    </main>
  )
}
