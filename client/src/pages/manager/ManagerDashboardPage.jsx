import {
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  TeamOutlined,
  UserAddOutlined,
} from '@ant-design/icons'
import { Card, Col, Row, Statistic, Table, Tag } from 'antd'
import PageHeader from '../shared/PageHeader.jsx'

const columns = [
  { title: 'Employee', dataIndex: 'employee', key: 'employee' },
  { title: 'Branch', dataIndex: 'branch', key: 'branch' },
  { title: 'In', dataIndex: 'clockIn', key: 'clockIn' },
  { title: 'Out', dataIndex: 'clockOut', key: 'clockOut' },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status) => <Tag>{status}</Tag>,
  },
]

export default function ManagerDashboardPage() {
  return (
    <>
      <PageHeader
        eyebrow="Manager"
        title="Dashboard"
        description="A quick operational view of today's attendance, late staff, and missing clock-outs."
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="Total employees" value={0} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="Present today" value={0} prefix={<UserAddOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="Late today" value={0} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="Missing clock-out" value={0} prefix={<ExclamationCircleOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card className="section-card" title="Today's attendance">
        <Table columns={columns} dataSource={[]} pagination={{ pageSize: 10 }} />
      </Card>
    </>
  )
}
