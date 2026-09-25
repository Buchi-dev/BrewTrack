import {
  CheckCircleOutlined,
} from '@ant-design/icons'
import { Alert, Divider, Modal, Steps as AntSteps, Tag, Typography, message } from 'antd'
import { useMemo, useRef, useState } from 'react'
import AttendanceCamera from './AttendanceCamera.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import {
  clockIn,
  clockOut,
  getAttendanceErrorMessage,
  getTodayAttendance,
  storeAttendanceSelfie,
} from '../../services/attendanceService.js'
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

export default function AttendanceFlowModal({ open, attendance, onClose, onSubmitted }) {
  const { profile, user } = useAuth()
  const [pendingEvidence, setPendingEvidence] = useState(() => getPendingEvidence(attendance))
  const [capturedPhoto, setCapturedPhoto] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [messageApi, contextHolder] = message.useMessage()

  const nextAction = getNextAction(attendance)
  const effectiveAction = pendingEvidence?.eventType ?? nextAction
  const actionLabel = effectiveAction ? ATTENDANCE_ACTIONS[effectiveAction] : 'COMPLETED'
  const employeeName = getFullName(profile) || user?.email || 'Employee'
  const branchName = profile?.branch_name || profile?.assigned_branch_name || 'Assigned branch'
  const watermarkLines = useMemo(
    () => [employeeName.toUpperCase(), actionLabel, formatDateTime(new Date()), branchName],
    [actionLabel, branchName, employeeName],
  )

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

    try {
      if (actionToSubmit === 'clockOut') {
        const currentAttendance = await getTodayAttendance()
        if (!(currentAttendance?.clock_in_at && !currentAttendance?.clock_out_at)) {
          throw new Error('Your attendance status changed. Refresh the page before submitting clock-out.')
        }
      }

      if (!pendingEvidence) {
        const created = actionToSubmit === 'clockIn' ? await clockIn() : await clockOut()
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
      if (attendanceId) setPendingEvidence({ attendanceId, attendanceDate: attendanceDate ?? new Date(), eventType: actionToSubmit })
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
        <AntSteps size="small" current={capturedPhoto ? 2 : 1} items={[{ title: 'Open camera' }, { title: 'Take selfie' }, { title: 'Review & submit' }]} />
        <div className="camera-modal-body">
          {effectiveAction ? (
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
