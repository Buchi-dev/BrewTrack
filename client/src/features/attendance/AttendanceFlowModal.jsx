import {
  CheckCircleOutlined,
} from '@ant-design/icons'
import { Alert, Button, Descriptions, Divider, Modal, Space, Steps as AntSteps, Tag, Typography, message } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import AttendanceCamera from './AttendanceCamera.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import {
  clockIn,
  clockOut,
  getAttendanceErrorMessage,
  getTodayAttendance,
  storeAttendanceSelfie,
} from '../../services/attendanceService.js'
import { syncOfflineAttendance } from '../../services/attendanceSyncService.js'
import { getOfflineAttendanceRecords, queueOfflineAttendance } from '../../services/offlineAttendanceService.js'
import { getDeviceId } from '../../services/deviceService.js'
import { formatDateTime } from '../../utils/date.js'

const { Text, Title } = Typography

const ATTENDANCE_ACTIONS = { clockIn: 'CLOCK IN', clockOut: 'CLOCK OUT' }

function getNextAction(attendance) {
  if (!attendance?.clock_in_at) return 'clockIn'
  if (!attendance?.clock_out_at) return 'clockOut'
  return null
}

function getPendingEvidence(attendance) {
  if (!attendance?.id) return null
  if (attendance.clock_in_at && !attendance.clock_in_photo_path) {
    return { attendanceId: attendance.id, attendanceDate: attendance.attendance_date ?? attendance.clock_in_at, eventType: 'clockIn' }
  }
  if (attendance.clock_out_at && !attendance.clock_out_photo_path) {
    return { attendanceId: attendance.id, attendanceDate: attendance.attendance_date ?? attendance.clock_out_at, eventType: 'clockOut' }
  }
  return null
}

function getAttendanceId(result) {
  if (!result) return null
  if (typeof result === 'string') return result
  if (Array.isArray(result)) return getAttendanceId(result[0])
  return result.id ?? result.attendance_id ?? getAttendanceId(result.attendance)
}

function getAttendanceDate(result) {
  if (!result) return new Date()
  if (Array.isArray(result)) return getAttendanceDate(result[0])
  return result.attendance_date ?? result.clock_in_at ?? result.clock_out_at ?? getAttendanceDate(result.attendance)
}

function getFullName(profile) {
  return [profile?.first_name, profile?.middle_name, profile?.last_name].filter(Boolean).join(' ').trim()
}

function shouldQueueAttendance(error) {
  return (
    !navigator.onLine
    || error?.name === 'TypeError'
    || /failed to fetch|network|fetch|connection/i.test(error?.message ?? '')
  )
}

function getAssignedStationLabel({ assignedStationLabel, attendance, profile }) {
  return (
    assignedStationLabel
    || attendance?.stationName
    || attendance?.station_name
    || attendance?.branch_name
    || profile?.branch_name
    || profile?.assigned_branch_name
    || 'Assigned station'
  )
}

export default function AttendanceFlowModal({ open, attendance, assignedStationLabel, onClose, onSubmitted }) {
  const { profile, user } = useAuth()
  const [pendingEvidence, setPendingEvidence] = useState(() => getPendingEvidence(attendance))
  const [capturedPhoto, setCapturedPhoto] = useState(null)
  const [identityConfirmed, setIdentityConfirmed] = useState(false)
  const [sharedDeviceBlock, setSharedDeviceBlock] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [messageApi, contextHolder] = message.useMessage()

  const nextAction = getNextAction(attendance)
  const effectiveAction = pendingEvidence?.eventType ?? nextAction
  const actionLabel = effectiveAction ? ATTENDANCE_ACTIONS[effectiveAction] : 'COMPLETED'
  const employeeName = getFullName(profile) || user?.email || 'Employee'
  const employeeNumber = profile?.employee_number || 'No employee number'
  const branchName = getAssignedStationLabel({ assignedStationLabel, attendance, profile })
  const deviceId = useMemo(() => getDeviceId(), [])
  const connectionLabel = navigator.onLine ? 'ONLINE CAPTURE' : 'OFFLINE CAPTURE'
  const watermarkLines = useMemo(
    () => [employeeName.toUpperCase(), employeeNumber, actionLabel, formatDateTime(new Date()), branchName, connectionLabel, deviceId],
    [actionLabel, branchName, connectionLabel, deviceId, employeeName, employeeNumber],
  )

  useEffect(() => {
    let active = true

    async function checkSharedDevice() {
      const records = await getOfflineAttendanceRecords()
      const otherUserRecord = records.find((record) => record.userId !== (user?.id || profile?.id))

      if (active) setSharedDeviceBlock(otherUserRecord || null)
    }

    if (open) {
      queueMicrotask(() => {
        if (!active) return
        setIdentityConfirmed(false)
        checkSharedDevice()
      })
    }

    return () => {
      active = false
    }
  }, [open, profile?.id, user?.id])

  const handleContinue = async (result) => {
    if (submittingRef.current || submitting) return
    if (!(result?.blob instanceof Blob)) {
      messageApi.error('Take a new selfie before submitting attendance.')
      return
    }

    const actionToSubmit = pendingEvidence?.eventType ?? nextAction
    if (!actionToSubmit) return

    submittingRef.current = true
    setSubmitting(true)
    let attendanceId = pendingEvidence?.attendanceId ?? null
    let attendanceDate = pendingEvidence?.attendanceDate ?? null
    const capturedAt = new Date().toISOString()
    const clientEventId = pendingEvidence?.clientEventId ?? crypto.randomUUID()

    try {
      if (!navigator.onLine) {
        await queueOfflineAttendance({
          id: clientEventId,
          userId: user?.id || profile?.id,
          action: actionToSubmit,
          photoBlob: result.blob,
          capturedAt,
          attendanceId,
          attendanceDate,
          deviceId,
        })

        messageApi.success(`${ATTENDANCE_ACTIONS[actionToSubmit]} recorded. It will sync when internet returns.`)
        onSubmitted?.({ queued: true })
        return
      }

      if (actionToSubmit === 'clockOut') {
        const currentAttendance = await getTodayAttendance()
        if (!(currentAttendance?.clock_in_at && !currentAttendance?.clock_out_at)) {
          throw new Error('Your attendance status changed. Refresh the page before submitting clock-out.')
        }
      }

      if (!pendingEvidence) {
        const attendancePayload = { clientEventId, capturedAt, wasOffline: false, deviceId }
        const created = actionToSubmit === 'clockIn'
          ? await clockIn(attendancePayload)
          : await clockOut(attendancePayload)
        attendanceId = getAttendanceId(created)
        attendanceDate = getAttendanceDate(created)
      }

      if (!attendanceId) throw new Error('Attendance was created, but the record ID was not returned.')

      await storeAttendanceSelfie({
        employeeId: user?.id || profile?.id,
        attendanceId,
        attendanceDate,
        eventType: actionToSubmit,
        photoBlob: result.blob,
      })

      messageApi.success(`${ATTENDANCE_ACTIONS[actionToSubmit]} submitted successfully.`)
      onSubmitted?.()
    } catch (error) {
      if (attendanceId || shouldQueueAttendance(error)) {
        try {
          await queueOfflineAttendance({
            id: clientEventId,
            userId: user?.id || profile?.id,
            action: actionToSubmit,
            photoBlob: result.blob,
            capturedAt,
            attendanceId,
            attendanceDate: attendanceDate ?? capturedAt,
            deviceId,
          })

          if (attendanceId) setPendingEvidence({ attendanceId, attendanceDate: attendanceDate ?? new Date(), eventType: actionToSubmit, clientEventId })
          messageApi.success(`${ATTENDANCE_ACTIONS[actionToSubmit]} recorded. Selfie sync is pending.`)
          syncOfflineAttendance({ userId: user?.id || profile?.id })
          onSubmitted?.({ queued: true })
          return
        } catch (queueError) {
          messageApi.error(queueError.message || 'Unable to save attendance on this device.')
          return
        }
      }

      messageApi.error(getAttendanceErrorMessage(error, 'Unable to submit attendance.'))
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <>
      {contextHolder}
      <Modal
        open={open}
        onCancel={() => !submitting && onClose?.()}
        footer={null}
        centered
        destroyOnClose
        width={760}
        title={null}
        className="attendance-camera-modal"
        maskClosable={false}
      >
        <div className="camera-modal-header">
          <div>
            <Text className="attendance-kicker">Secure attendance</Text>
            <Title level={3}>{effectiveAction === 'clockIn' ? 'Clock in selfie' : 'Clock out selfie'}</Title>
            <Text type="secondary">Follow the three steps below. Nothing is submitted until you confirm.</Text>
          </div>
          <Tag color={effectiveAction === 'clockIn' ? 'blue' : 'orange'}>{actionLabel}</Tag>
        </div>
        <Divider />
        <AntSteps
          size="small"
          current={identityConfirmed ? (capturedPhoto ? 3 : 2) : 0}
          items={[
            { title: 'Confirm identity' },
            { title: 'Open camera' },
            { title: 'Take selfie' },
            { title: 'Review & submit' },
          ]}
        />
        <div className="camera-modal-body">
          {effectiveAction && !identityConfirmed ? (
            <Space direction="vertical" size={16} className="full-width">
              {sharedDeviceBlock && (
                <Alert
                  type="error"
                  showIcon
                  message="This device has unsynced attendance for another employee."
                  description="Sync that attendance first or ask a manager. New attendance is blocked to prevent shared-phone identity mistakes."
                />
              )}
              <Alert
                type={navigator.onLine ? 'info' : 'warning'}
                showIcon
                message={navigator.onLine ? 'Server verification will be attempted now.' : 'Offline capture is device evidence only.'}
                description={navigator.onLine ? 'Confirm the identity before opening the camera.' : 'This is not final attendance until it syncs and passes server validation.'}
              />
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Employee">{employeeName}</Descriptions.Item>
                <Descriptions.Item label="Employee no.">{employeeNumber}</Descriptions.Item>
                <Descriptions.Item label="Action">{actionLabel}</Descriptions.Item>
                <Descriptions.Item label="Station">{branchName}</Descriptions.Item>
                <Descriptions.Item label="Device">{deviceId}</Descriptions.Item>
                <Descriptions.Item label="Connection">{navigator.onLine ? 'Online' : 'Offline'}</Descriptions.Item>
                <Descriptions.Item label="Current time">{formatDateTime(new Date())}</Descriptions.Item>
              </Descriptions>
              <Space wrap>
                <Button onClick={onClose} disabled={submitting}>Cancel</Button>
                <Button
                  type="primary"
                  disabled={Boolean(sharedDeviceBlock)}
                  onClick={() => setIdentityConfirmed(true)}
                >
                  Yes, this is me
                </Button>
              </Space>
            </Space>
          ) : effectiveAction ? (
            <AttendanceCamera
              actionLabel={actionLabel}
              watermarkLines={watermarkLines}
              onCapture={setCapturedPhoto}
              onContinue={handleContinue}
              onCancel={onClose}
              continueLabel={submitting ? 'Submitting...' : `Confirm ${actionLabel.toLowerCase()}`}
              continueLoading={submitting}
            />
          ) : (
            <Alert type="success" showIcon icon={<CheckCircleOutlined />} message="Today’s attendance is complete" />
          )}
        </div>
      </Modal>
    </>
  )
}
