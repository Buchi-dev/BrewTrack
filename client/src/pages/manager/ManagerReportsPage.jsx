import { DownloadOutlined } from '@ant-design/icons'
import { Button, Card, Col, DatePicker, Row, Space, Typography } from 'antd'
import PageHeader from '../shared/PageHeader.jsx'

const { Paragraph, Title } = Typography

export default function ManagerReportsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Manager"
        title="Reports"
        description="Generate daily, monthly, employee, late, and missing clock-out reports."
      />
      <Card>
        <Space wrap className="table-toolbar">
          <DatePicker picker="month" />
          <Button type="primary" icon={<DownloadOutlined />}>
            Export CSV
          </Button>
        </Space>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card size="small">
              <Title level={4}>Daily summary</Title>
              <Paragraph type="secondary">Attendance count, late staff, and incomplete sessions.</Paragraph>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card size="small">
              <Title level={4}>Employee report</Title>
              <Paragraph type="secondary">Per-employee attendance history and totals.</Paragraph>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card size="small">
              <Title level={4}>Exception report</Title>
              <Paragraph type="secondary">Late arrivals and missing clock-outs.</Paragraph>
            </Card>
          </Col>
        </Row>
      </Card>
    </>
  )
}
