import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BankOutlined,
  AuditOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Button, Drawer, Grid, Layout, Menu, Space, Typography, message } from 'antd'
import { BRAND } from '../constants/brand.js'
import { ROUTES } from '../constants/routes.js'
import { DEFAULT_TIMEZONE } from '../constants/settings.js'
import { signOut } from '../services/authService.js'
import { useAuth } from '../hooks/useAuth.js'

const { Header, Content, Sider } = Layout
const { Text } = Typography

const managerItems = [
  { key: ROUTES.managerDashboard, icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: ROUTES.managerAttendance, icon: <ClockCircleOutlined />, label: 'Attendance' },
  { key: ROUTES.managerEmployees, icon: <TeamOutlined />, label: 'Employees' },
  { key: ROUTES.managerBranches, icon: <BankOutlined />, label: 'Branches' },
  { key: ROUTES.managerReports, icon: <FileTextOutlined />, label: 'Reports' },
  { key: ROUTES.managerAudit, icon: <AuditOutlined />, label: 'Audit' },
  { key: ROUTES.managerSettings, icon: <SettingOutlined />, label: 'Settings' },
]

const staffItems = [
  { key: ROUTES.staffHome, icon: <DashboardOutlined />, label: 'Today' },
  { key: ROUTES.staffAttendance, icon: <ClockCircleOutlined />, label: 'Attendance' },
  { key: ROUTES.staffHistory, icon: <CalendarOutlined />, label: 'History' },
  { key: ROUTES.staffProfile, icon: <UserOutlined />, label: 'Profile' },
]

function getDisplayName(profile) {
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
  return name || `${BRAND.shortName} User`
}

function TodayClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const date = new Intl.DateTimeFormat('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: DEFAULT_TIMEZONE,
  }).format(now)

  const time = new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZone: DEFAULT_TIMEZONE,
  }).format(now)

  return (
    <div className="today-clock" aria-label={`Today is ${date}, ${time}`}>
      <CalendarOutlined />
      <div>
        <Text className="today-clock-date">{date}</Text>
        <Text className="today-clock-time">{time}</Text>
      </div>
    </div>
  )
}

function NavAccount({ profile, onSignOut }) {
  return (
    <div className="nav-account">
      <Space align="center" size={10}>
        <Avatar icon={<UserOutlined />} />
        <div className="nav-account-copy">
          <Text className="nav-account-name">{getDisplayName(profile)}</Text>
          <Text className="nav-account-role">{profile?.role || 'workspace user'}</Text>
        </div>
      </Space>
      <Button className="nav-signout" icon={<LogoutOutlined />} onClick={onSignOut}>
        Sign out
      </Button>
    </div>
  )
}

export default function AppLayout({ section }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const screens = Grid.useBreakpoint()
  const { profile } = useAuth()
  const [api, contextHolder] = message.useMessage()
  const items = section === 'manager' ? managerItems : staffItems
  const selectedKeys = useMemo(() => {
    const active = items.find((item) => pathname === item.key) ?? items[0]
    return [active.key]
  }, [items, pathname])

  async function handleSignOut() {
    try {
      await signOut()
      navigate(ROUTES.login, { replace: true })
    } catch (error) {
      api.error(error.message)
    }
  }

  const menu = (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={selectedKeys}
      items={items}
      onClick={({ key }) => {
        navigate(key)
        setDrawerOpen(false)
      }}
    />
  )

  return (
    <Layout className="app-layout">
      {contextHolder}
      {screens.md ? (
        <Sider width={244} className="app-sider">
          <div className="sider-shell">
            <div>
              <div className="sider-brand">
                <img src={BRAND.logos.icon} alt="" />
                <span>{BRAND.shortName}</span>
              </div>
              {menu}
            </div>
            <NavAccount profile={profile} onSignOut={handleSignOut} />
          </div>
        </Sider>
      ) : (
        <Drawer
          open={drawerOpen}
          placement="left"
          onClose={() => setDrawerOpen(false)}
          width="min(88vw, 300px)"
          className="mobile-nav"
        >
          <div className="sider-brand mobile">
            <img src={BRAND.logos.brown} alt="" />
            <span>{BRAND.shortName}</span>
          </div>
          {menu}
          <NavAccount profile={profile} onSignOut={handleSignOut} />
        </Drawer>
      )}

      <Layout>
        <Header className="topbar">
          <Space align="center">
            {!screens.md && (
              <Button
                type="text"
                icon={drawerOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
                onClick={() => setDrawerOpen(true)}
                aria-label="Open navigation"
              />
            )}
            <div>
              <Text className="eyebrow">{section}</Text>
              <div className="topbar-title">Attendance workspace</div>
            </div>
          </Space>

          <TodayClock />
        </Header>

        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
