import {
  CalendarOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  ReloadOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Alert, Button, Card, Empty, List, Radio, Space, Tag, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import {
  formatScheduleTimeRange,
  getStaffStationSchedule,
  getStationLabel,
  getStationRoleLabel,
} from '../../services/manager/stationScheduleService.js'
import { formatDate } from '../../utils/date.js'

const { Text } = Typography

const VIEW_OPTIONS = [
  { label: 'This week', value: 'week' },
  { label: 'This month', value: 'month' },
]

function getInputDate(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function parseInputDate(value) {
  return new Date(`${value}T00:00:00`)
}

function addDays(date, days) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function getRangeForView(view) {
  const today = parseInputDate(getInputDate(new Date()))

  if (view === 'month') {
    return {
      startDate: getInputDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      endDate: getInputDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    }
  }

  const mondayOffset = today.getDay() === 0 ? -6 : 1 - today.getDay()
  const start = addDays(today, mondayOffset)
  return {
    startDate: getInputDate(start),
    endDate: getInputDate(addDays(start, 6)),
  }
}

function getDateTitle(value) {
  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(parseInputDate(value))
}

function getStaffName(member) {
  return [member?.firstName, member?.middleName, member?.lastName].filter(Boolean).join(' ') || 'Unnamed staff'
}

function getCompanions(assignment, profileId) {
  return (assignment.team ?? []).filter((member) => member.employeeId !== profileId)
}

function ScheduleCard({ assignment, profileId }) {
  const companions = getCompanions(assignment, profileId)
  const trainer = assignment.team?.find((member) => member.employeeId === assignment.trainerEmployeeId)

  return (
    <Card className="staff-schedule-card">
      <div className="staff-schedule-card-head">
        <div>
          <Text className="attendance-kicker">Shift</Text>
          <Typography.Title level={3}>{getDateTitle(assignment.scheduleDate)}</Typography.Title>
        </div>
        <Tag color={assignment.stationRole === 'trainee' ? 'gold' : 'blue'}>
          {getStationRoleLabel(assignment.stationRole)}
        </Tag>
      </div>

      <div className="staff-schedule-detail-grid">
        <div>
          <EnvironmentOutlined />
          <span>
            <Text type="secondary">Station</Text>
            <Text strong>{getStationLabel(assignment)}</Text>
          </span>
        </div>
        <div>
          <ClockCircleOutlined />
          <span>
            <Text type="secondary">Time</Text>
            <Text strong>{formatScheduleTimeRange(assignment.scheduledStart, assignment.scheduledEnd)}</Text>
          </span>
        </div>
      </div>

      {trainer && (
        <div className="staff-schedule-note">
          <Text type="secondary">Trainer</Text>
          <Text strong>{getStaffName(trainer)}</Text>
        </div>
      )}

      <div className="staff-schedule-team">
        <div className="staff-schedule-team-title">
          <TeamOutlined />
          <Text strong>{companions.length ? 'Companions' : 'Companions'}</Text>
          <Tag>{companions.length}</Tag>
        </div>
        {companions.length ? (
          <List
            size="small"
            dataSource={companions}
            renderItem={(member) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<UserOutlined />}
                  title={getStaffName(member)}
                  description={`${getStationRoleLabel(member.stationRole)} • ${formatScheduleTimeRange(
                    member.scheduledStart,
                    member.scheduledEnd,
                  )}`}
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No companions listed yet" />
        )}
      </div>
    </Card>
  )
}

export default function StaffSchedulePage() {
  const { profile } = useAuth()
  const [view, setView] = useState('week')
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState(null)

  const range = useMemo(() => getRangeForView(view), [view])

  const loadSchedule = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)

    try {
      const rows = await getStaffStationSchedule(range.startDate, range.endDate)
      setAssignments(rows)
    } catch (error) {
      setErrorMessage(error.message || 'Unable to load your schedule.')
    } finally {
      setLoading(false)
    }
  }, [range.endDate, range.startDate])

  useEffect(() => {
    let active = true

    getStaffStationSchedule(range.startDate, range.endDate)
      .then((rows) => {
        if (!active) return
        setAssignments(rows)
        setErrorMessage(null)
      })
      .catch((error) => {
        if (!active) return
        setErrorMessage(error.message || 'Unable to load your schedule.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [range.endDate, range.startDate])

  return (
    <div className="staff-schedule-page">
      <PageHeader
        eyebrow="Schedule"
        title="My schedule"
        description="See your station, position, shift time, and companions for this week or month."
        actions={
          <Button icon={<ReloadOutlined />} onClick={loadSchedule} loading={loading}>
            Refresh
          </Button>
        }
      />

      {errorMessage && (
        <Alert className="section-card" type="error" showIcon message={errorMessage} />
      )}

      <Card className="staff-schedule-toolbar-card">
        <Space wrap className="staff-schedule-toolbar">
          <Radio.Group
            optionType="button"
            buttonStyle="solid"
            options={VIEW_OPTIONS}
            value={view}
            onChange={(event) => {
              setLoading(true)
              setView(event.target.value)
            }}
          />
          <div className="schedule-summary-pill">
            <CalendarOutlined />
            <span>
              {formatDate(range.startDate)} - {formatDate(range.endDate)}
            </span>
          </div>
          <div className="schedule-summary-pill">
            <TeamOutlined />
            <span>{assignments.length} scheduled shift{assignments.length === 1 ? '' : 's'}</span>
          </div>
        </Space>
      </Card>

      <div className="staff-schedule-list" aria-busy={loading}>
        {assignments.length ? (
          assignments.map((assignment) => (
            <ScheduleCard key={assignment.id} assignment={assignment} profileId={profile?.id} />
          ))
        ) : (
          <Card className="staff-schedule-empty-card">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={loading ? 'Loading schedule...' : 'No scheduled shifts for this view'}
            />
          </Card>
        )}
      </div>
    </div>
  )
}
