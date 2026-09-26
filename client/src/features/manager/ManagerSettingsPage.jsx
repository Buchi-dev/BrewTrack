import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Row,
  Segmented,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd'
import { EnvironmentOutlined, LockOutlined, SaveOutlined, SettingOutlined } from '@ant-design/icons'
import PageHeader from '../../components/PageHeader.jsx'
import { BRAND } from '../../constants/brand.js'

const { Text, Title } = Typography

export default function ManagerSettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Manager"
        title="Settings"
        description="Review operational defaults for timekeeping, evidence, and station verification."
        actions={
          <Button type="primary" icon={<SaveOutlined />} disabled>
            Save settings
          </Button>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card className="settings-readiness-card">
            <Space orientation="vertical" size={14} className="full-width">
              <div className="settings-readiness-icon">
                <SettingOutlined />
              </div>
              <div>
                <Text className="attendance-kicker">Operational defaults</Text>
                <Title level={3}>Set the rules managers rely on every day.</Title>
                <Text type="secondary">
                  These settings shape clock-in grace periods, location checks, and the evidence managers review later.
                </Text>
              </div>
              <Divider />
              <Space wrap>
                <Tag color="blue">Draft screen</Tag>
                <Tag color="gold">Backend save pending</Tag>
              </Space>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card className="settings-form-card">
            <Alert
              className="manager-page-alert"
              type="info"
              showIcon
              title="Settings are laid out for manager review"
              description="Saving still needs the app_settings service wiring, so the save action is intentionally disabled until persistence is available."
            />

            <Form layout="vertical" initialValues={{ timezone: 'Asia/Manila', gracePeriod: 0, evidenceMode: 'selfie', requireLocation: false }}>
              <div className="settings-section-heading">
                <Text className="attendance-kicker">Workspace</Text>
                <Title level={4}>Business identity</Title>
              </div>
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
              </Row>

              <div className="settings-section-heading">
                <Text className="attendance-kicker">Attendance rules</Text>
                <Title level={4}>Clock-in expectations</Title>
              </div>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item label="Default grace period" name="gracePeriod" extra="Minutes before a staff member is marked late.">
                    <InputNumber min={0} addonAfter="minutes" className="full-width" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Evidence mode" name="evidenceMode">
                    <Segmented
                      block
                      options={[
                        { label: 'Selfie', value: 'selfie' },
                        { label: 'Selfie + location', value: 'selfieLocation' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Require location evidence" name="requireLocation" valuePropName="checked">
                    <Switch checkedChildren={<EnvironmentOutlined />} unCheckedChildren={<LockOutlined />} />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>
        </Col>
      </Row>
    </>
  )
}
