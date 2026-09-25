import { CameraOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { Alert, Card, Col, Radio, Row, Space, Steps, Tag, Typography, message } from 'antd'
import { useMemo, useState } from 'react'
import AttendanceCamera from '../../features/attendance/AttendanceCamera.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { formatDateTime } from '../../utils/date.js'
import PageHeader from '../shared/PageHeader.jsx'

const { Paragraph, Text } = Typography
const ATTENDANCE_ACTIONS = {
  clockIn: 'CLOCK IN',
  clockOut: 'CLOCK OUT',
}

function getFullName(profile) {
  return [profile?.first_name, profile?.middle_name, profile?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()
}

export default function StaffAttendancePage() {
  const { profile } = useAuth()
  const [attendanceAction, setAttendanceAction] = useState('clockIn')
  const [capturedPhoto, setCapturedPhoto] = useState(null)
  const [messageApi, contextHolder] = message.useMessage()

  const employeeName = getFullName(profile) || 'Employee'
  const actionLabel = ATTENDANCE_ACTIONS[attendanceAction]
  const branchName = profile?.branch_name || profile?.assigned_branch_name || 'Assigned branch'

  const watermarkLines = useMemo(
    () => [
      employeeName.toUpperCase(),
      actionLabel,
      formatDateTime(new Date()),
      branchName,
    ],
    [actionLabel, branchName, employeeName],
  )

  const handleActionChange = (event) => {
    setAttendanceAction(event.target.value)
    setCapturedPhoto(null)
  }

  const handleContinue = (result) => {
    setCapturedPhoto(result)
    messageApi.success('Selfie prepared for secure attendance submission.')
  }

  return (
    <>
      {contextHolder}
      <PageHeader
        eyebrow="Attendance"
        title="Clock in or clock out"
        description="Take a new live selfie, review the watermarked photo, then continue to the secure attendance transaction."
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card className="camera-card">
            <Space direction="vertical" size="middle" className="full-width">
              <Radio.Group
                optionType="button"
                buttonStyle="solid"
                value={attendanceAction}
                onChange={handleActionChange}
                options={[
                  { label: 'Clock in', value: 'clockIn' },
                  { label: 'Clock out', value: 'clockOut' },
                ]}
              />

              <AttendanceCamera
                actionLabel={actionLabel}
                watermarkLines={watermarkLines}
                onCapture={setCapturedPhoto}
                onContinue={handleContinue}
                continueLabel="Use this selfie"
              />
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Photo evidence">
            <Space direction="vertical" size="small" className="full-width">
              <Tag color={capturedPhoto ? 'success' : 'default'} icon={<CameraOutlined />}>
                {capturedPhoto ? 'Selfie captured' : 'Waiting for selfie'}
              </Tag>
              <Text strong>{employeeName}</Text>
              <Text type="secondary">{actionLabel}</Text>
              <Text type="secondary">{branchName}</Text>
              <Paragraph type="secondary">
                The watermark is visible evidence only. Official time and attendance status still
                come from the secure Supabase attendance transaction.
              </Paragraph>
            </Space>
          </Card>

          <Card title="Secure workflow">
            <Steps
              direction="vertical"
              current={capturedPhoto ? 2 : 0}
              items={[
                { title: 'Open camera', description: 'Use the device front camera by default.' },
                { title: 'Capture selfie', description: 'No gallery upload control is provided.' },
                {
                  title: 'Confirm transaction',
                  description: 'Server time and branch rules are enforced by Supabase RPC.',
                },
                { title: 'Store evidence', description: 'Selfies are saved to a private storage bucket.' },
              ]}
            />
          </Card>
          <Alert
            className="section-card"
            type="info"
            showIcon
            icon={<CheckCircleOutlined />}
            message="Server time is authoritative"
            description="The client can preview local time on the photo, but official attendance timestamps come from PostgreSQL."
          />
        </Col>
      </Row>
    </>
  )
}
