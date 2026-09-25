import { Card, Col, Form, Input, InputNumber, Row, Switch } from 'antd'
import PageHeader from '../../components/PageHeader.jsx'
import { BRAND } from '../../constants/brand.js'

export default function ManagerSettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Manager"
        title="Settings"
        description="Organization-level settings that will be stored in app_settings."
      />
      <Card>
        <Form layout="vertical" initialValues={{ timezone: 'Asia/Manila', gracePeriod: 0 }}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Organization name" name="organizationName">
                <Input placeholder={BRAND.shortName} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Default timezone" name="timezone">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Default grace period" name="gracePeriod">
                <InputNumber min={0} addonAfter="minutes" className="full-width" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Require location evidence" name="requireLocation" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>
    </>
  )
}
