import { CameraOutlined, CheckCircleOutlined, RedoOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Col, Row, Space, Steps, Typography } from 'antd'
import PageHeader from '../shared/PageHeader.jsx'

const { Paragraph, Text } = Typography

export default function StaffAttendancePage() {
  return (
    <>
      <PageHeader
        eyebrow="Attendance"
        title="Clock in or clock out"
        description="This page is prepared for the secure camera flow: live capture, preview, watermark, upload, then server-confirmed attendance."
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card className="camera-card">
            <div className="camera-placeholder">
              <CameraOutlined />
              <Text strong>Camera preview will appear here</Text>
              <Paragraph type="secondary">
                The next milestone will add getUserMedia capture, canvas watermarking, and private
                Supabase Storage upload.
              </Paragraph>
            </div>
            <Space wrap className="camera-actions">
              <Button type="primary" size="large" icon={<CameraOutlined />}>
                Start camera
              </Button>
              <Button size="large" icon={<RedoOutlined />}>
                Retake
              </Button>
              <Button size="large" icon={<CheckCircleOutlined />}>
                Submit
              </Button>
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Secure workflow">
            <Steps
              direction="vertical"
              current={0}
              items={[
                { title: 'Open camera', description: 'Use the device front camera by default.' },
                { title: 'Capture selfie', description: 'No gallery upload control is provided.' },
                { title: 'Confirm transaction', description: 'Server time and branch rules are enforced by Supabase RPC.' },
                { title: 'Store evidence', description: 'Selfies are saved to a private storage bucket.' },
              ]}
            />
          </Card>
          <Alert
            className="section-card"
            type="info"
            showIcon
            message="Server time is authoritative"
            description="The client can preview local time, but official timestamps will come from PostgreSQL when the RPC functions are added."
          />
        </Col>
      </Row>
    </>
  )
}
