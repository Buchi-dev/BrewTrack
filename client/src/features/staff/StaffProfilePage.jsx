import { IdcardOutlined, MailOutlined, PhoneOutlined, SafetyCertificateOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons'
import { Avatar, Card, Tag, Typography } from 'antd'
import PageHeader from '../../components/PageHeader.jsx'
import { useAuth } from '../../hooks/useAuth.js'

const { Text } = Typography

function getFullName(profile) {
  return [profile?.first_name, profile?.middle_name, profile?.last_name].filter(Boolean).join(' ') || 'Staff member'
}

function getInitials(profile) {
  const names = [profile?.first_name, profile?.last_name].filter(Boolean)
  return names.map((name) => name.charAt(0)).join('').toUpperCase() || 'S'
}

function formatValue(value) {
  return value || '--'
}

const profileItems = [
  { key: 'email', label: 'Email', icon: <MailOutlined /> },
  { key: 'employee_number', label: 'Employee no.', icon: <IdcardOutlined /> },
  { key: 'phone', label: 'Phone', icon: <PhoneOutlined /> },
  { key: 'role', label: 'Role', icon: <TeamOutlined /> },
]

export default function StaffProfilePage() {
  const { profile, user } = useAuth()
  const fullName = getFullName(profile)
  const itemValues = {
    email: user?.email,
    employee_number: profile?.employee_number,
    phone: profile?.phone,
    role: profile?.role,
  }

  return (
    <div className="staff-profile-page">
      <PageHeader
        eyebrow="Profile"
        title="My profile"
        description="Profile data is tied to the authenticated Supabase user."
      />

      <Card className="staff-profile-card">
        <div className="staff-profile-identity">
          <Avatar size={72} className="staff-profile-avatar" icon={<UserOutlined />}>
            {getInitials(profile)}
          </Avatar>
          <div>
            <Text className="attendance-kicker">Staff profile</Text>
            <Typography.Title level={2}>{fullName}</Typography.Title>
            <div className="staff-profile-tags">
              <Tag color={profile?.status === 'active' ? 'green' : 'default'} className="text-capitalize">
                <SafetyCertificateOutlined /> {formatValue(profile?.status)}
              </Tag>
              <Tag color="blue" className="text-capitalize">
                {formatValue(profile?.role)}
              </Tag>
            </div>
          </div>
        </div>

        <div className="staff-profile-grid">
          {profileItems.map((item) => (
            <div key={item.key} className="staff-profile-info-tile">
              <span className="staff-profile-info-icon">{item.icon}</span>
              <div>
                <Text type="secondary">{item.label}</Text>
                <Text strong className={item.key === 'role' ? 'text-capitalize' : ''}>
                  {formatValue(itemValues[item.key])}
                </Text>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
