import {
  CalendarOutlined,
  CameraOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CoffeeOutlined,
  EnvironmentOutlined,
  HistoryOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { Alert, Button, Card, Col, Row, Statistic, Tag, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/common/PageHeader.jsx'
import { ROUTES } from '../../../constants/routes.js'
import { useAuth } from '../../../hooks/useAuth.js'
import {
  getStaffAttendanceHistory,
  getTodayAttendance,
} from '../../../services/attendanceService.js'
import { formatDate, formatTime } from '../../../utils/date.js'
import AttendanceFlowModal from '../../attendance/AttendanceFlowModal.jsx'

const { Text } = Typography

const STATUS_COLORS = {
  absent: 'default',
  completed: 'success',
  excused: 'blue',
  incomplete: 'processing',
  late: 'warning',
  present: 'success',
}

function getTodayStatusLabel(attendance) {
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

export default function StaffHomePage() {
  const { profile } = useAuth()
  const [todayAttendance, setTodayAttendance] = useState(null)
  const [recentRecords, setRecentRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState(null)
  const [cameraOpen, setCameraOpen] = useState(false)

  const firstName = profile?.first_name || 'there'
  const branchName = profile?.branch_name || profile?.assigned_branch_name || 'Pending setup'

  const loadSummary = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)

    try {
      const [today, history] = await Promise.all([
        getTodayAttendance(),
        getStaffAttendanceHistory({ page: 1, pageSize: 31 }),
      ])

      setTodayAttendance(today)
      setRecentRecords(history.records)
    } catch (error) {
      setErrorMessage(error.message || 'Unable to load attendance summary.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true

    Promise.all([
      getTodayAttendance(),
      getStaffAttendanceHistory({ page: 1, pageSize: 31 }),
    ])
      .then(([today, history]) => {
        if (!active) return
        setTodayAttendance(today)
        setRecentRecords(history.records)
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

  const completedThisMonth = useMemo(() => getCompletedCount(recentRecords), [recentRecords])
  const nextAction = getNextActionText(todayAttendance)
  const isComplete = nextAction === 'View attendance'

  return (
    <>
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

      <Card className="staff-dashboard-hero" bordered={false}>
        <div className="staff-dashboard-hero-main">
          <div className="staff-dashboard-hero-topline">
            <Text className="attendance-kicker">Today’s shift</Text>
            <Tag color={getStatusColor(todayAttendance)}>{getTodayStatusLabel(todayAttendance)}</Tag>
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
        <Col xs={24} md={8}>
          <Card className="staff-metric-card staff-metric-status">
            <Statistic
              title="Today's status"
              value={getTodayStatusLabel(todayAttendance)}
              prefix={<ClockCircleOutlined />}
              loading={loading}
            />
            <Tag className="status-tag" color={getStatusColor(todayAttendance)}>
              {todayAttendance?.status || 'Waiting'}
            </Tag>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="staff-metric-card">
            <Statistic title="Assigned branch" value={branchName} loading={loading} />
            <Text type="secondary">Your attendance is filed against your assigned branch.</Text>
          </Card>
        </Col>
        <Col xs={24} md={8}>
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
              <div className={`staff-shift-line ${todayAttendance?.clock_in_at ? 'is-done' : ''}`}>
                <span className="staff-shift-dot"><ClockCircleOutlined /></span>
                <div><Text strong>Clock in</Text><Text type="secondary">{formatTime(todayAttendance?.clock_in_at)}</Text></div>
              </div>
              <div className={`staff-shift-line ${todayAttendance?.clock_out_at ? 'is-done' : ''}`}>
                <span className="staff-shift-dot"><CheckCircleOutlined /></span>
                <div><Text strong>Clock out</Text><Text type="secondary">{formatTime(todayAttendance?.clock_out_at)}</Text></div>
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
        key={`${cameraOpen ? 'open' : 'closed'}-${todayAttendance?.id ?? 'none'}-${todayAttendance?.clock_in_at ?? 'none'}-${todayAttendance?.clock_out_at ?? 'none'}`}
        open={cameraOpen}
        attendance={todayAttendance}
        onClose={() => setCameraOpen(false)}
        onSubmitted={() => {
          setCameraOpen(false)
          loadSummary()
        }}
      />
    </>
  )
}
