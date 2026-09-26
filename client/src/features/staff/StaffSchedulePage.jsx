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

const { Text } = Typography

const VIEW_OPTIONS = [
  { label: 'This week', value: 'week' },
  { label: 'This month', value: 'month' },
]

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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

function getTodayInputDate() {
  return getInputDate(new Date())
}

function getRangeForView(view, anchorDate = getTodayInputDate()) {
  const anchor = parseInputDate(anchorDate)

  if (view === 'month') {
    return {
      startDate: getInputDate(new Date(anchor.getFullYear(), anchor.getMonth(), 1)),
      endDate: getInputDate(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)),
    }
  }

  const mondayOffset = anchor.getDay() === 0 ? -6 : 1 - anchor.getDay()
  const start = addDays(anchor, mondayOffset)
  return {
    startDate: getInputDate(start),
    endDate: getInputDate(addDays(start, 6)),
  }
}

function getCalendarDays(view, startDate, endDate) {
  if (view === 'week') {
    const start = parseInputDate(startDate)
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(start, index)
      return {
        date: getInputDate(date),
        dayNumber: date.getDate(),
        isCurrentRange: true,
      }
    })
  }

  const start = parseInputDate(startDate)
  const firstGridDate = addDays(start, -start.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(firstGridDate, index)
    const inputDate = getInputDate(date)
    return {
      date: inputDate,
      dayNumber: date.getDate(),
      isCurrentRange: inputDate >= startDate && inputDate <= endDate,
    }
  })
}

function getCalendarTitle(view, startDate) {
  const date = parseInputDate(startDate)

  if (view === 'month') {
    return new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(date)
  }

  const weekStart = new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)

  return `Week of ${weekStart}`
}

function getSelectedDateTitle(value) {
  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(parseInputDate(value))
}

function getStaffName(member) {
  return [member?.firstName, member?.middleName, member?.lastName].filter(Boolean).join(' ') || 'Unnamed staff'
}

function getCompanions(assignment, profileId) {
  return (assignment?.team ?? []).filter((member) => member.employeeId !== profileId)
}

function ScheduleInfo({ assignment, loading, profileId, selectedDate }) {
  const companions = getCompanions(assignment, profileId)
  const trainer = assignment?.team?.find((member) => member.employeeId === assignment.trainerEmployeeId)

  if (!assignment) {
    return (
      <Card className="staff-schedule-info-card">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={loading ? 'Loading schedule...' : `No shift scheduled on ${getSelectedDateTitle(selectedDate)}`}
        />
      </Card>
    )
  }

  return (
    <Card className="staff-schedule-info-card">
      <div className="staff-schedule-info-head">
        <div>
          <Text className="attendance-kicker">Selected day</Text>
          <Typography.Title level={2}>{getSelectedDateTitle(assignment.scheduleDate)}</Typography.Title>
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
            <Text type="secondary">Shift time</Text>
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
          <Text strong>Companions</Text>
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
  const [view, setView] = useState('month')
  const [selectedDate, setSelectedDate] = useState(getTodayInputDate())
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState(null)

  const range = useMemo(() => getRangeForView(view, selectedDate), [selectedDate, view])
  const calendarDays = useMemo(
    () => getCalendarDays(view, range.startDate, range.endDate),
    [range.endDate, range.startDate, view],
  )
  const assignmentsByDate = useMemo(
    () => new Map(assignments.map((assignment) => [assignment.scheduleDate, assignment])),
    [assignments],
  )
  const selectedAssignment = assignmentsByDate.get(selectedDate)

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

  function handleViewChange(nextView) {
    setLoading(true)
    setView(nextView)
  }

  function handleSelectDate(date) {
    if (date < range.startDate || date > range.endDate) {
      setLoading(true)
    }

    setSelectedDate(date)
  }

  return (
    <div className="staff-schedule-page">
      <PageHeader
        eyebrow="Schedule"
        title="My schedule"
        description="Choose a day in the calendar to see your station, position, shift time, and companions."
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
            onChange={(event) => handleViewChange(event.target.value)}
          />
          <div className="schedule-summary-pill">
            <CalendarOutlined />
            <span>{getCalendarTitle(view, range.startDate)}</span>
          </div>
          <div className="schedule-summary-pill">
            <TeamOutlined />
            <span>{assignments.length} scheduled shift{assignments.length === 1 ? '' : 's'}</span>
          </div>
        </Space>
      </Card>

      <div className="staff-schedule-calendar-layout" aria-busy={loading}>
        <Card className="staff-schedule-calendar-card">
          <div className="schedule-calendar-grid schedule-calendar-weekdays">
            {WEEKDAYS.map((day) => (
              <Text key={day} type="secondary">{day}</Text>
            ))}
          </div>
          <div className="schedule-calendar-grid">
            {calendarDays.map((day) => {
              const assignment = assignmentsByDate.get(day.date)
              const isSelected = day.date === selectedDate
              const isToday = day.date === getTodayInputDate()

              return (
                <button
                  type="button"
                  key={day.date}
                  className={`staff-schedule-calendar-day ${day.isCurrentRange ? '' : 'is-muted'} ${
                    isSelected ? 'is-selected' : ''
                  } ${assignment ? 'has-shift' : ''}`}
                  onClick={() => handleSelectDate(day.date)}
                >
                  <span className="staff-schedule-calendar-number">
                    {day.dayNumber}
                    {isToday && <small>Today</small>}
                  </span>
                  {assignment && (
                    <span className="staff-schedule-calendar-shift">
                      <strong>{getStationRoleLabel(assignment.stationRole)}</strong>
                      <small>{formatScheduleTimeRange(assignment.scheduledStart, assignment.scheduledEnd)}</small>
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </Card>

        <ScheduleInfo
          assignment={selectedAssignment}
          loading={loading}
          profileId={profile?.id}
          selectedDate={selectedDate}
        />
      </div>
    </div>
  )
}
