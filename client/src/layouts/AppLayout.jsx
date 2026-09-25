import { useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  AuditOutlined,
  BankOutlined,
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
import { ROUTES } from '../constants/routes.js'
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
  return name || 'BrewTrack User'
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
          <div className="sider-brand">
            <AuditOutlined />
            <span>BrewTrack</span>
          </div>
          {menu}
        </Sider>
      ) : (
        <Drawer
          open={drawerOpen}
          placement="left"
          onClose={() => setDrawerOpen(false)}
          width={280}
          className="mobile-nav"
        >
          <div className="sider-brand mobile">
            <AuditOutlined />
            <span>BrewTrack</span>
          </div>
          {menu}
        </Drawer>
      )}

      <Layout>
        <Header className="topbar">
          <Space>
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

          <Space>
            <Avatar icon={<UserOutlined />} />
            {screens.sm && <Text strong>{getDisplayName(profile)}</Text>}
            <Button icon={<LogoutOutlined />} onClick={handleSignOut}>
              Sign out
            </Button>
          </Space>
        </Header>

        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
