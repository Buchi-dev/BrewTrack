import {
  CameraOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FieldTimeOutlined,
  InfoCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Row,
  Space,
  Spin,
  Statistic,
  Steps,
  Tag,
  Typography,
  message,
} from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import AttendanceCamera from '../../features/attendance/AttendanceCamera.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import {
  clockIn,
  clockOut,
  getAttendanceErrorMessage,
  getTodayAttendance,
  storeAttendanceSelfie,
} from '../../services/attendanceService.js'
import { formatDate, formatDateTime } from '../../utils/date.js'
import PageHeader from '../shared/PageHeader.jsx'

const { Paragraph, Text } = Typography

const ATTENDANCE_ACTIONS = {
  clockIn: 'CLOCK IN',
  clockOut: 'CLOCK OUT',
}

const STATUS_META = {
  absent: { color: 'default', label: 'Absent' },
  completed: { color: 'success', label: 'Completed' },
  excused: { color: 'blue', label: 'Excused' },
  incomplete: { color: 'processing', label: 'Working' },
  late: { color: 'warning', label: 'Late' },
  present: { color: 'success', label: 'Present' },
}

function getFullName(profile) {
  return [profile?.first_name, profile?.middle_name, profile?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()
}

function getStatusMeta(status) {
  return STATUS_META[status] ?? { color: 'default', label: status || 'Not clocked in' }
}

function getNextAction(attendance) {
  if (!attendance?.clock_in_at) return 'clockIn'
  if (!attendance?.clock_out_at) return 'clockOut'
  return null
}

function getTodayStatusLabel(attendance) {
  if (!attendance?.clock_in_at) return 'Not clocked in'
  if (!attendance?.clock_out_at) return 'Currently working'
  return 'Shift completed'
}

function formatMinutes(value) {
  if (!Number.isFinite(value)) return '--'

  const hours = Math.floor(value / 60)
  const minutes = value % 60

  if (hours <= 0) return `${minutes}m`
  if (minutes <= 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

function getAttendanceId(result) {
  if (!result) return null
  if (typeof result === 'string') return result
  if (Array.isArray(result)) return getAttendanceId(result[0])
  return result.id ?? result.attendance_id ?? null
}

function getAttendanceDate(result) {
  if (!result) return new Date()
  if (Array.isArray(result)) return getAttendanceDate(result[0])
  return result.attendance_date ?? result.clock_in_at ?? result.clock_out_at ?? new Date()
}

export default function StaffAttendancePage() {
  const { profile, user } = useAuth()
  const [todayAttendance, setTodayAttendance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [capturedPhoto, setCapturedPhoto] = useState(null)
  const [pendingEvidence, setPendingEvidence] = useState(null)
  const [messageApi, contextHolder] = message.useMessage()

  const employeeName = getFullName(profile) || user?.email || 'Employee'
  const nextAction = getNextAction(todayAttendance)
  const effectiveAction = pendingEvidence?.eventType ?? nextAction
  const actionLabel = effectiveAction ? ATTENDANCE_ACTIONS[effectiveAction] : 'COMPLETED'
  const branchName = profile?.branch_name || profile?.assigned_branch_name || 'Assigned branch'
  const statusMeta = getStatusMeta(todayAttendance?.status)

  const loadTodayAttendance = useCallback(async () => {
    setLoading(true)
    try {
      const attendance = await getTodayAttendance()
      setTodayAttendance(attendance)
      setCapturedPhoto(null)
    } catch (error) {
      messageApi.error(error.message || 'Unable to load today\'s attendance.')
    } finally {
      setLoading(false)
    }
  }, [messageApi])

  useEffect(() => {
    let active = true

    getTodayAttendance()
      .then((attendance) => {
        if (!active) return
        setTodayAttendance(attendance)
        setCapturedPhoto(null)
      })
      .catch((error) => {
        if (!active) return
        messageApi.error(error.message || 'Unable to load today\'s attendance.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [messageApi])

  const watermarkLines = useMemo(
    () => [
      employeeName.toUpperCase(),
      actionLabel,
      formatDateTime(new Date()),
      branchName,
    ],
    [actionLabel, branchName, employeeName],
  )

  const handleCapture = (result) => {
    setCapturedPhoto(result)
  }

  const handleContinue = async (result) => {
    const actionToSubmit = pendingEvidence?.eventType ?? nextAction
    if (!actionToSubmit || submitting) return

    const photoBlob = result?.blob
    if (!(photoBlob instanceof Blob)) {
      messageApi.error('Take a new selfie before submitting attendance.')
      return
    }

    setSubmitting(true)

    let attendanceId = pendingEvidence?.attendanceId ?? null
    let attendanceDate = pendingEvidence?.attendanceDate ?? null

    try {
      if (!pendingEvidence) {
        const attendance = actionToSubmit === 'clockIn' ? await clockIn() : await clockOut()
        attendanceId = getAttendanceId(attendance)
        attendanceDate = getAttendanceDate(attendance)
      }

      if (!attendanceId) {
        throw new Error('Attendance was created, but the record ID was not returned.')
      }

      await storeAttendanceSelfie({
        employeeId: profile?.id || user?.id,
        attendanceId,
        attendanceDate,
        eventType: actionToSubmit,
        photoBlob,
      })

      setPendingEvidence(null)
      messageApi.success(`${ATTENDANCE_ACTIONS[actionToSubmit]} submitted successfully.`)
      await loadTodayAttendance()
    } catch (error) {
      if (attendanceId && actionToSubmit) {
        setPendingEvidence({
          attendanceId,
          attendanceDate: attendanceDate ?? new Date(),
          eventType: actionToSubmit,
        })
      }
      messageApi.error(getAttendanceErrorMessage(error, 'Unable to submit attendance.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {contextHolder}
      <PageHeader
        eyebrow="Attendance"
        title="Clock in or clock out"
        description="Take a new live selfie, review the watermarked photo, then submit the secure attendance transaction."
        actions={
          <Button onClick={loadTodayAttendance} loading={loading}>
            Refresh status
          </Button>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card className="camera-card">
            {loading ? (
              <div className="attendance-panel-loading">
                <Spin indicator={<LoadingOutlined spin />} />
              </div>
            ) : nextAction ? (
              <Space direction="vertical" size="middle" className="full-width">
                <Alert
                  type={nextAction === 'clockIn' ? 'info' : 'warning'}
                  showIcon
                  message={nextAction === 'clockIn' ? 'Ready to clock in' : 'Ready to clock out'}
                  description="The camera must capture a new selfie for this attendance action."
                />
                <AttendanceCamera
                  actionLabel={actionLabel}
                  watermarkLines={watermarkLines}
                  onCapture={handleCapture}
                  onContinue={handleContinue}
                  continueLabel={submitting ? 'Submitting...' : `Submit ${actionLabel.toLowerCase()}`}
                  continueLoading={submitting}
                />
                {submitting && (
                  <Alert
                    type="info"
                    showIcon
                    message="Submitting attendance"
                    description="Please keep this page open while the attendance record and private selfie are saved."
                  />
                )}
              </Space>
            ) : (
              <Alert
                type="success"
                showIcon
                icon={<CheckCircleOutlined />}
                message="Today's attendance is complete"
                description="You have already clocked in and clocked out for today."
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="Today's status">
            <Space direction="vertical" size="middle" className="full-width">
              <Statistic
                title={formatDate(new Date())}
                value={getTodayStatusLabel(todayAttendance)}
                prefix={<ClockCircleOutlined />}
              />
              <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Employee">{employeeName}</Descriptions.Item>
                <Descriptions.Item label="Branch">{branchName}</Descriptions.Item>
                <Descriptions.Item label="Clock in">
                  {formatDateTime(todayAttendance?.clock_in_at)}
                </Descriptions.Item>
                <Descriptions.Item label="Clock out">
                  {formatDateTime(todayAttendance?.clock_out_at)}
                </Descriptions.Item>
                <Descriptions.Item label="Late minutes">
                  {formatMinutes(todayAttendance?.late_minutes)}
                </Descriptions.Item>
                <Descriptions.Item label="Worked time">
                  {formatMinutes(todayAttendance?.worked_minutes)}
                </Descriptions.Item>
              </Descriptions>
            </Space>
          </Card>

          <Card title="Photo evidence" className="section-card">
            <Space direction="vertical" size="small" className="full-width">
              <Tag color={capturedPhoto ? 'success' : 'default'} icon={<CameraOutlined />}>
                {capturedPhoto ? 'Selfie captured' : 'Waiting for selfie'}
              </Tag>
              <Text strong>{employeeName}</Text>
              <Text type="secondary">{actionLabel}</Text>
              <Paragraph type="secondary">
                The watermark is visible evidence only. Official time and attendance status come
                from the secure Supabase attendance transaction.
              </Paragraph>
            </Space>
          </Card>

          <Card title="Secure workflow" className="section-card">
            <Steps
              direction="vertical"
              current={capturedPhoto ? 2 : 0}
              items={[
                { title: 'Open camera', icon: <CameraOutlined /> },
                { title: 'Capture selfie', icon: <FieldTimeOutlined /> },
                { title: 'Submit transaction', icon: <InfoCircleOutlined /> },
                { title: 'Store evidence', icon: <CheckCircleOutlined /> },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </>
  )
}
