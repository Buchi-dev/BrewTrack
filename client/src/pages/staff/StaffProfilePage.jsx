import { Card, Descriptions } from 'antd'
import { useAuth } from '../../hooks/useAuth.js'
import PageHeader from '../shared/PageHeader.jsx'

export default function StaffProfilePage() {
  const { profile, user } = useAuth()

  return (
    <>
      <PageHeader
        eyebrow="Profile"
        title="My profile"
        description="Profile data is tied to the authenticated Supabase user."
      />
      <Card>
        <Descriptions bordered column={{ xs: 1, md: 2 }}>
          <Descriptions.Item label="Name">
            {[profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || '--'}
          </Descriptions.Item>
          <Descriptions.Item label="Email">{user?.email || '--'}</Descriptions.Item>
          <Descriptions.Item label="Role">{profile?.role || '--'}</Descriptions.Item>
          <Descriptions.Item label="Status">{profile?.status || '--'}</Descriptions.Item>
          <Descriptions.Item label="Employee number">{profile?.employee_number || '--'}</Descriptions.Item>
          <Descriptions.Item label="Phone">{profile?.phone || '--'}</Descriptions.Item>
        </Descriptions>
      </Card>
    </>
  )
}
