import { CameraOutlined, ClockCircleOutlined, HistoryOutlined } from '@ant-design/icons'
import { Button, Card, Col, Row, Space, Statistic, Tag, Typography } from 'antd'
import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes.js'
import { useAuth } from '../../hooks/useAuth.js'
import PageHeader from '../shared/PageHeader.jsx'

const { Text } = Typography

export default function StaffHomePage() {
  const { profile } = useAuth()
  const firstName = profile?.first_name || 'there'

  return (
    <>
      <PageHeader
        eyebrow="Staff"
        title={`Good day, ${firstName}`}
        description="Review today's attendance status and start a camera-based clock in or clock out."
        actions={
          <Link to={ROUTES.staffAttendance}>
            <Button type="primary" icon={<CameraOutlined />}>
              Open attendance
            </Button>
          </Link>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Today's status" value="Not clocked in" prefix={<ClockCircleOutlined />} />
            <Tag className="status-tag" color="default">
              Waiting
            </Tag>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Assigned branch" value="Pending setup" />
            <Text type="secondary">Branch assignment comes from employee_branches.</Text>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="This month" value={0} suffix="completed shifts" />
            <Text type="secondary">Attendance totals will load after database milestone.</Text>
          </Card>
        </Col>
      </Row>

      <Card className="section-card" title="Fast actions">
        <Space wrap>
          <Link to={ROUTES.staffAttendance}>
            <Button type="primary" icon={<CameraOutlined />}>
              Clock in / out
            </Button>
          </Link>
          <Link to={ROUTES.staffHistory}>
            <Button icon={<HistoryOutlined />}>View history</Button>
          </Link>
        </Space>
      </Card>
    </>
  )
}
