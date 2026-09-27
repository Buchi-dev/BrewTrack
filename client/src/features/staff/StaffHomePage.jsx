import {
  CalendarOutlined,
  CameraOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CoffeeOutlined,
  EnvironmentOutlined,
  HistoryOutlined,
  ReloadOutlined,
  SyncOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Alert, Button, Card, Col, Empty, List, Row, Statistic, Tag, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../components/PageHeader.jsx'
import { ROUTES } from '../../constants/routes.js'
import { useAuth } from '../../hooks/useAuth.js'
import {
  getStaffAttendanceHistory,
  getTodayAttendance,
} from '../../services/attendanceService.js'
import { syncOfflineAttendance } from '../../services/attendanceSyncService.js'
import {
  OFFLINE_ATTENDANCE_STATUSES,
  getOfflineAttendanceRecords,
  subscribeToAttendanceSyncUpdates,
} from '../../services/offlineAttendanceService.js'
import {
  getStationLabel,
  getStationRoleLabel,
  getTodayStationAssignment,
  formatScheduleTimeRange,
} from '../../services/manager/stationScheduleService.js'
import { formatDate, formatTime } from '../../utils/date.js'
import AttendanceFlowModal from '../attendance/AttendanceFlowModal.jsx'

const { Text } = Typography

const STATUS_COLORS = {
  absent: 'default',
  completed: 'success',
  excused: 'blue',
  incomplete: 'processing',
  late: 'warning',
  pending_sync: 'warning',
  present: 'success',
}

function getTodayStatusLabel(attendance, pendingRecords = []) {
  if (pendingRecords.some((record) => record.action === 'clockOut')) return 'Clock-out pending sync'
  if (pendingRecords.some((record) => record.action === 'clockIn') && !attendance?.clock_in_at) return 'Clock-in pending sync'
  if (!attendance?.clock_in_at) return 'Not clocked in'
  if (!attendance?.clock_out_at) return 'Working'
  return 'Completed'
}

function getStatusColor(attendance) {
  if (!attendance?.clock_in_at) return 'default'
  return STATUS_COLORS[attendance.status] ?? 'processing'
}

function getNextActionText(attendance) {
  if (!attendance?.clock_in_at) return 'Clock in'
  if (!attendance?.clock_out_at) return 'Clock out'
  return 'View attendance'
}

function getCompletedCount(records) {
  return records.filter((record) => record.clock_in_at && record.clock_out_at).length
}

function getTeamMemberName(member) {
  return [member?.firstName, member?.middleName, member?.lastName].filter(Boolean).join(' ') || 'Unnamed staff'
}

function mergePendingAttendance(attendance, pendingRecords) {
  if (!pendingRecords.length) return attendance

  const pendingClockIn = pendingRecords.find((record) => record.action === 'clockIn')
  const pendingClockOut = pendingRecords.find((record) => record.action === 'clockOut')

  return {
    ...(attendance ?? {}),
    clock_in_at: attendance?.clock_in_at ?? pendingClockIn?.capturedAt ?? null,
    clock_out_at: attendance?.clock_out_at ?? pendingClockOut?.capturedAt ?? null,
    status: pendingRecords.length ? 'pending_sync' : attendance?.status,
  }
}

function getPendingSyncMessage(records) {
  if (records.some((record) => record.status === OFFLINE_ATTENDANCE_STATUSES.needsReview)) {
    return 'Attendance is saved on this device, but it needs manager help before it can be accepted.'
  }

  if (records.some((record) => record.status === OFFLINE_ATTENDANCE_STATUSES.failed)) {
    return 'Attendance is saved on this device, but sync needs another try.'
  }

  if (records.some((record) => record.status === OFFLINE_ATTENDANCE_STATUSES.uploading)) {
    return 'Attendance is saved on this device and is syncing now.'
  }

  return 'Attendance is saved on this device and will sync when internet is available.'
}

export default function StaffHomePage() {
  const { profile } = useAuth()
  const [todayAttendance, setTodayAttendance] = useState(null)
  const [todaySchedule, setTodaySchedule] = useState(null)
  const [recentRecords, setRecentRecords] = useState([])
  const [pendingRecords, setPendingRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)
  const [cameraOpen, setCameraOpen] = useState(false)

  const firstName = profile?.first_name || 'there'
  const branchName = todaySchedule ? getStationLabel(todaySchedule) : 'No station scheduled'
  const displayAttendance = useMemo(
    () => mergePendingAttendance(todayAttendance, pendingRecords),
    [pendingRecords, todayAttendance],
  )

  const loadPendingRecords = useCallback(async () => {
    if (!profile?.id) {
      setPendingRecords([])
      return
    }

    const records = await getOfflineAttendanceRecords({ userId: profile?.id })
    setPendingRecords(records)
  }, [profile?.id])

  const loadSummary = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)

    try {
      const [today, history, schedule] = await Promise.all([
        getTodayAttendance(),
        getStaffAttendanceHistory({ page: 1, pageSize: 31 }),
        getTodayStationAssignment(),
      ])

      setTodayAttendance(today)
      setRecentRecords(history.records)
      setTodaySchedule(schedule)
    } catch (error) {
      setErrorMessage(error.message || 'Unable to load attendance summary.')
    } finally {
      setLoading(false)
    }
  }, [])

  const retrySync = useCallback(async () => {
    if (!profile?.id) return

    setSyncing(true)

    try {
      await syncOfflineAttendance({ userId: profile?.id })
      await Promise.all([loadPendingRecords(), loadSummary()])
    } finally {
      setSyncing(false)
    }
  }, [loadPendingRecords, loadSummary, profile?.id])

  useEffect(() => {
    let active = true

    Promise.all([
      getTodayAttendance(),
      getStaffAttendanceHistory({ page: 1, pageSize: 31 }),
      getTodayStationAssignment(),
    ])
      .then(([today, history, schedule]) => {
        if (!active) return
        setTodayAttendance(today)
        setRecentRecords(history.records)
        setTodaySchedule(schedule)
        setErrorMessage(null)
      })
      .catch((error) => {
        if (!active) return
        setErrorMessage(error.message || 'Unable to load attendance summary.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const unsubscribe = subscribeToAttendanceSyncUpdates(loadPendingRecords)
    const handleOnline = () => {
      retrySync()
    }

    globalThis.addEventListener('online', handleOnline)
    queueMicrotask(() => {
      loadPendingRecords()
      if (navigator.onLine) retrySync()
    })

    return () => {
      unsubscribe()
      globalThis.removeEventListener('online', handleOnline)
    }
  }, [loadPendingRecords, retrySync])

  const completedThisMonth = useMemo(() => getCompletedCount(recentRecords), [recentRecords])
  const nextAction = getNextActionText(displayAttendance)
  const isComplete = nextAction === 'View attendance'
  const trainer = todaySchedule?.team?.find((member) => member.employeeId === todaySchedule.trainerEmployeeId)
  const trainee = todaySchedule?.team?.find((member) => member.trainerEmployeeId === profile?.id)

  return (
    <div className="staff-dashboard-page">
      <PageHeader
        eyebrow="Staff dashboard"
        title={`Good day, ${firstName}`}
        description="Everything you need for today’s shift, in one place."
        actions={
          <Button icon={<ReloadOutlined />} onClick={loadSummary} loading={loading}>Refresh</Button>
        }
      />

      {errorMessage && (
        <Alert className="section-card" type="error" showIcon message={errorMessage} />
      )}

      {pendingRecords.length > 0 && (
        <Alert
          className="section-card attendance-sync-alert"
          type="warning"
          showIcon
          message={getPendingSyncMessage(pendingRecords)}
          action={
            <Button size="small" icon={<SyncOutlined />} loading={syncing} onClick={retrySync}>
              Retry sync
            </Button>
          }
        />
      )}

      <Card className="staff-dashboard-hero" bordered={false}>
        <div className="staff-dashboard-hero-main">
          <div className="staff-dashboard-hero-topline">
            <Text className="attendance-kicker">Today’s shift</Text>
            <Tag color={getStatusColor(displayAttendance)}>{getTodayStatusLabel(displayAttendance, pendingRecords)}</Tag>
          </div>
          <Typography.Title level={2}>
            {isComplete ? 'You’re all set.' : nextAction === 'Clock out' ? 'Finish strong.' : 'Ready when you are.'}
          </Typography.Title>
          <Text className="staff-dashboard-hero-subtitle">
            {isComplete
              ? 'Your attendance has been recorded for today.'
              : nextAction === 'Clock out'
                ? 'Your shift is in progress. Capture a selfie when you’re ready to clock out.'
                : 'Start your shift with a quick, secure selfie.'}
          </Text>
          <div className="staff-dashboard-hero-meta">
            <span><EnvironmentOutlined /> {branchName}</span>
            <span><CalendarOutlined /> {formatDate(new Date())}</span>
          </div>
        </div>
        <div className="staff-dashboard-hero-action">
          <div className="staff-hero-orbit"><CameraOutlined /></div>
          <Text type="secondary">{isComplete ? 'Attendance complete' : 'One clear selfie'}</Text>
        </div>
        <div className="staff-dashboard-hero-button">
          <Button type="primary" size="large" icon={<CameraOutlined />} onClick={() => setCameraOpen(true)}>
            {nextAction}
          </Button>
        </div>
      </Card>

      <Row className="staff-dashboard-metrics" gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card className="staff-metric-card staff-metric-status">
            <Statistic
              title="Today's status"
              value={getTodayStatusLabel(displayAttendance, pendingRecords)}
              prefix={<ClockCircleOutlined />}
              loading={loading}
            />
            <Tag className="status-tag" color={getStatusColor(displayAttendance)}>
              {displayAttendance?.status || 'Waiting'}
            </Tag>
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card className="staff-metric-card">
            <Statistic title="Today's station" value={branchName} loading={loading} />
            <Text type="secondary">Your attendance is filed against today’s schedule.</Text>
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card className="staff-metric-card">
            <Statistic
              title="Recent completed shifts"
              value={completedThisMonth}
              suffix="shifts"
              prefix={<CalendarOutlined />}
              loading={loading}
            />
            <Text type="secondary">Based on the most recent attendance records.</Text>
          </Card>
        </Col>
      </Row>

      <Row className="staff-lower-grid" gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card
            className="staff-station-card staff-lower-card"
            title={<span className="staff-card-title"><TeamOutlined /> Station assignment</span>}
          >
            {todaySchedule ? (
              <div className="staff-station-panel">
                <div>
                  <Text type="secondary">Today</Text>
                  <Typography.Title level={3}>{getStationLabel(todaySchedule)}</Typography.Title>
                  <Tag color={todaySchedule.stationRole === 'trainee' ? 'gold' : 'blue'}>
                    {getStationRoleLabel(todaySchedule.stationRole)}
                  </Tag>
                  <Tag color="purple">
                    {formatScheduleTimeRange(todaySchedule.scheduledStart, todaySchedule.scheduledEnd)}
                  </Tag>
                </div>
                {trainer && (
                  <div className="staff-station-note">
                    <Text type="secondary">Trainer</Text>
                    <Text strong>{getTeamMemberName(trainer)}</Text>
                  </div>
                )}
                {trainee && (
                  <div className="staff-station-note">
                    <Text type="secondary">Trainee</Text>
                    <Text strong>{getTeamMemberName(trainee)}</Text>
                  </div>
                )}
                <List
                  size="small"
                  dataSource={todaySchedule.team ?? []}
                  renderItem={(member) => (
                    <List.Item>
                      <List.Item.Meta
                        title={getTeamMemberName(member)}
                        description={`${getStationRoleLabel(member.stationRole)} • ${formatScheduleTimeRange(
                          member.scheduledStart,
                          member.scheduledEnd,
                        )}`}
                      />
                    </List.Item>
                  )}
                />
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No station assignment yet" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card
            className="staff-today-card staff-lower-card"
            title={<span className="staff-card-title"><CoffeeOutlined /> Today’s brew</span>}
          >
            <div className="staff-shift-timeline">
              <div className="staff-shift-line is-active">
                <span className="staff-shift-dot"><CalendarOutlined /></span>
                <div><Text strong>{formatDate(new Date())}</Text><Text type="secondary">Your shift at {branchName}</Text></div>
              </div>
              <div className={`staff-shift-line ${displayAttendance?.clock_in_at ? 'is-done' : ''}`}>
                <span className="staff-shift-dot"><ClockCircleOutlined /></span>
                <div><Text strong>Clock in</Text><Text type="secondary">{formatTime(displayAttendance?.clock_in_at)}</Text></div>
              </div>
              <div className={`staff-shift-line ${displayAttendance?.clock_out_at ? 'is-done' : ''}`}>
                <span className="staff-shift-dot"><CheckCircleOutlined /></span>
                <div><Text strong>Clock out</Text><Text type="secondary">{formatTime(displayAttendance?.clock_out_at)}</Text></div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            className="staff-history-card staff-lower-card"
            title={<span className="staff-card-title"><HistoryOutlined /> Brew history</span>}
          >
            <div className="staff-history-action">
              <div><Text strong>Previous shifts</Text><Text type="secondary">Review attendance records and selfie evidence.</Text></div>
              <Link to={ROUTES.staffHistory}>
                <Button icon={<HistoryOutlined />}>View history</Button>
              </Link>
            </div>
          </Card>
        </Col>
      </Row>

      <AttendanceFlowModal
        key={`${cameraOpen ? 'open' : 'closed'}-${displayAttendance?.id ?? 'none'}-${displayAttendance?.clock_in_at ?? 'none'}-${displayAttendance?.clock_out_at ?? 'none'}`}
        open={cameraOpen}
        attendance={displayAttendance}
        assignedStationLabel={todaySchedule ? branchName : null}
        onClose={() => setCameraOpen(false)}
        onSubmitted={() => {
          setCameraOpen(false)
          loadPendingRecords()
          loadSummary()
        }}
      />
    </div>
  )
}
