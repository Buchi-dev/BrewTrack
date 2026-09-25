import {
  CalendarOutlined,
  CameraOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { Alert, Button, Card, Col, Row, Space, Statistic, Tag, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes.js'
import { useAuth } from '../../hooks/useAuth.js'
import {
  getStaffAttendanceHistory,
  getTodayAttendance,
} from '../../services/attendanceService.js'
import { formatDate, formatTime } from '../../utils/date.js'
import PageHeader from '../shared/PageHeader.jsx'

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

  return (
    <>
      <PageHeader
        eyebrow="Staff"
        title={`Good day, ${firstName}`}
        description="Review today's attendance status and start a camera-based clock in or clock out."
        actions={
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={loadSummary} loading={loading}>
              Refresh
            </Button>
            <Link to={ROUTES.staffAttendance}>
              <Button type="primary" icon={<CameraOutlined />}>
                {getNextActionText(todayAttendance)}
              </Button>
            </Link>
          </Space>
        }
      />

      {errorMessage && (
        <Alert className="section-card" type="error" showIcon message={errorMessage} />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
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
          <Card>
            <Statistic title="Assigned branch" value={branchName} loading={loading} />
            <Text type="secondary">Your attendance is filed against your assigned branch.</Text>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
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

      <Card className="section-card" title="Today">
        <Space direction="vertical" size="small" className="full-width">
          <Text>
            <strong>Date:</strong> {formatDate(new Date())}
          </Text>
          <Text>
            <strong>Clock in:</strong> {formatTime(todayAttendance?.clock_in_at)}
          </Text>
          <Text>
            <strong>Clock out:</strong> {formatTime(todayAttendance?.clock_out_at)}
          </Text>
        </Space>
      </Card>

      <Card className="section-card" title="Fast actions">
        <Space wrap>
          <Link to={ROUTES.staffAttendance}>
            <Button type="primary" icon={<CameraOutlined />}>
              Clock in / out
            </Button>
          </Link>
          <Link to={ROUTES.staffHistory}>
            <Button icon={<HistoryOutlined />}>View history</Button>
          </Link>
        </Space>
      </Card>
    </>
  )
}
