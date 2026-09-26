import {
  CalendarOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  LeftOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  TeamOutlined,
  UserAddOutlined,
} from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'
import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import { listAllBranches } from '../../services/manager/branchService.js'
import { listActiveStaff, getFullName } from '../../services/manager/employeeService.js'
import {
  deleteStationScheduleAssignment,
  getScheduleStaffName,
  getStationLabel,
  getStationRoleLabel,
  listStationScheduleAssignments,
  listStationScheduleAssignmentsRange,
  saveStationScheduleAssignment,
  STATION_ROLE_OPTIONS,
} from '../../services/manager/stationScheduleService.js'

const { Text } = Typography
const MIN_STAFF_PER_STATION = 3
const MAX_STAFF_PER_STATION = 4
const DEFAULT_SHIFT_START = '07:00'
const DEFAULT_SHIFT_END = '18:00'

function getTodayInputDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function parseInputDate(date) {
  return new Date(`${date}T00:00:00`)
}

function toInputDate(date) {
  return new Intl.DateTimeFormat('en-CA').format(date)
}

function addMonths(date, months) {
  const nextDate = parseInputDate(date)
  nextDate.setMonth(nextDate.getMonth() + months)
  return toInputDate(nextDate)
}

function getMonthBounds(date) {
  const parsedDate = parseInputDate(date)
  const start = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1)
  const end = new Date(parsedDate.getFullYear(), parsedDate.getMonth() + 1, 0)
  return { start: toInputDate(start), end: toInputDate(end) }
}

function getCalendarDays(date) {
  const parsedDate = parseInputDate(date)
  const firstOfMonth = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1)
  const firstGridDate = new Date(firstOfMonth)
  firstGridDate.setDate(firstGridDate.getDate() - firstOfMonth.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstGridDate)
    day.setDate(firstGridDate.getDate() + index)
    return {
      date: toInputDate(day),
      dayNumber: day.getDate(),
      isCurrentMonth: day.getMonth() === parsedDate.getMonth(),
    }
  })
}

function groupByStation(stations, assignments) {
  return stations.map((station) => ({
    station,
    assignments: assignments.filter((assignment) => assignment.branch_id === station.id),
  }))
}

function getStaffingTone(count) {
  if (count === 0) return { label: 'Empty', color: 'default', status: 'needs-attention' }
  if (count < MIN_STAFF_PER_STATION) return { label: 'Needs staff', color: 'gold', status: 'needs-attention' }
  if (count <= MAX_STAFF_PER_STATION) return { label: 'Ready', color: 'green', status: 'ready' }
  return { label: 'Overstaffed', color: 'red', status: 'conflict' }
}

function getMonthTitle(date) {
  return new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(parseInputDate(date))
}

function getSelectedDateTitle(date) {
  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(parseInputDate(date))
}

function getCompactDateTitle(date) {
  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(parseInputDate(date))
}

function CommandAssignmentChip({ assignment, onEdit, onDelete }) {
  return (
    <div className="schedule-command-assignment">
      <div className="schedule-command-assignment-name">
        <Text strong>{getScheduleStaffName(assignment.profiles)}</Text>
      </div>
      <Space size={4}>
        <Button type="text" icon={<EditOutlined />} onClick={() => onEdit(assignment)} aria-label="Edit assignment" />
        <Popconfirm
          title="Remove this assignment?"
          okText="Remove"
          okButtonProps={{ danger: true }}
          onConfirm={() => onDelete(assignment.id)}
        >
          <Button type="text" danger icon={<DeleteOutlined />} aria-label="Remove assignment" />
        </Popconfirm>
      </Space>
    </div>
  )
}

function StaffCard({ employee, isSelected, onSelect }) {
  return (
    <button
      type="button"
      className={`schedule-staff-card ${isSelected ? 'is-selected' : ''}`}
      onClick={() => onSelect(employee.id)}
    >
      <Text strong title={getFullName(employee)}>{getFullName(employee)}</Text>
    </button>
  )
}

function AssignmentCommandCenter({
  assignedByEmployeeId,
  availableStaffCount,
  selectedStaff,
  selectedStaffAssignment,
  selectedStaffStation,
  selectedStaffId,
  stationGroups,
  staff,
  onClearSelectedStaff,
  onDeleteAssignment,
  onEditAssignment,
  onPickRole,
  onSelectStaff,
}) {
  const availableStaff = staff.filter((employee) => !assignedByEmployeeId.has(employee.id))

  return (
    <Card className="schedule-command-card">
      <div className="schedule-command-head">
        <div>
          <Text className="attendance-kicker">Assign command center</Text>
          <Typography.Title level={2}>Pick staff, then role.</Typography.Title>
        </div>
        {selectedStaff ? (
          <div className="schedule-selected-staff">
            <Text type="secondary">Selected staff</Text>
            <Text strong>{getFullName(selectedStaff)}</Text>
            <Button size="small" onClick={onClearSelectedStaff}>Clear</Button>
          </div>
        ) : (
          <div className="schedule-selected-staff is-empty">
            <UserAddOutlined />
            <Text strong>Select staff</Text>
            <Text type="secondary">Then choose a role.</Text>
          </div>
        )}
      </div>

      {selectedStaffAssignment && (
        <div className="schedule-command-warning">
          <ExclamationCircleOutlined />
          <Text>
            {getFullName(selectedStaff)} is already assigned to {getStationLabel(selectedStaffStation)}.
          </Text>
        </div>
      )}

      <div className="schedule-command-roster">
        <div className="schedule-command-section-head">
          <Text strong>Available staff</Text>
          <Tag color="blue">{availableStaffCount} available</Tag>
        </div>
        <div className="schedule-command-staff-grid">
          {availableStaff.length ? (
            availableStaff.map((employee) => (
              <StaffCard
                key={employee.id}
                employee={employee}
                isSelected={selectedStaffId === employee.id}
                onSelect={onSelectStaff}
              />
            ))
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={staff.length ? 'All staff assigned' : 'No active staff'}
            />
          )}
        </div>
      </div>

      <div className="schedule-command-matrix">
        <div className="schedule-command-section-head">
          <Text strong>Station role targets</Text>
        </div>
        {stationGroups.map(({ station, assignments: stationAssignments }) => {
          const stationIsFull = stationAssignments.length >= MAX_STAFF_PER_STATION
          const tone = getStaffingTone(stationAssignments.length)

          return (
            <div className="schedule-command-row" key={station.id}>
              <div className="schedule-command-station">
                <Text strong>{getStationLabel(station)}</Text>
                <Space size={5} wrap>
                  <Tag color={tone.color}>{tone.label}</Tag>
                  <Tag>{stationAssignments.length}/{MAX_STAFF_PER_STATION}</Tag>
                </Space>
              </div>
              <div className="schedule-command-slots">
                {STATION_ROLE_OPTIONS.map((role) => {
                  const roleAssignments = stationAssignments.filter(
                    (assignment) => assignment.station_role === role.value,
                  )
                  return (
                    <div
                      key={role.value}
                      className={`schedule-command-slot ${roleAssignments.length ? 'has-assignment' : ''}`}
                    >
                      <button
                        type="button"
                        className="schedule-command-slot-action"
                        onClick={() => onPickRole(station.id, role.value)}
                        disabled={stationIsFull}
                      >
                        <span>{role.label}</span>
                        {!roleAssignments.length && <small>{selectedStaff ? 'Assign here' : 'Open'}</small>}
                      </button>
                      {roleAssignments.map((assignment) => (
                        <CommandAssignmentChip
                          key={assignment.id}
                          assignment={assignment}
                          onEdit={onEditAssignment}
                          onDelete={onDeleteAssignment}
                        />
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export default function ManagerSchedulesPage() {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [scheduleDate, setScheduleDate] = useState(getTodayInputDate())
  const [assignments, setAssignments] = useState([])
  const [monthAssignments, setMonthAssignments] = useState([])
  const [stations, setStations] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState(null)
  const [selectedStaffId, setSelectedStaffId] = useState(null)
  const selectedRole = Form.useWatch('station_role', form)
  const selectedStationId = Form.useWatch('branch_id', form)
  const selectedEmployee = Form.useWatch('employee_id', form)

  async function loadData(date = scheduleDate) {
    setLoading(true)
    try {
      const { start, end } = getMonthBounds(date)
      const [assignmentRows, monthRows, stationRows, staffRows] = await Promise.all([
        listStationScheduleAssignments(date),
        listStationScheduleAssignmentsRange(start, end),
        listAllBranches(),
        listActiveStaff(),
      ])
      setAssignments(assignmentRows)
      setMonthAssignments(monthRows)
      setStations(stationRows.filter((station) => station.is_active))
      setStaff(staffRows)
    } catch (error) {
      message.error(error.message || 'Unable to load schedules.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      setLoading(true)
      try {
        const { start, end } = getMonthBounds(scheduleDate)
        const [assignmentRows, monthRows, stationRows, staffRows] = await Promise.all([
          listStationScheduleAssignments(scheduleDate),
          listStationScheduleAssignmentsRange(start, end),
          listAllBranches(),
          listActiveStaff(),
        ])
        if (!isMounted) return
        setAssignments(assignmentRows)
        setMonthAssignments(monthRows)
        setStations(stationRows.filter((station) => station.is_active))
        setStaff(staffRows)
      } catch (error) {
        if (isMounted) message.error(error.message || 'Unable to load schedules.')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadInitialData()

    return () => {
      isMounted = false
    }
  }, [message, scheduleDate])

  const staffById = useMemo(() => new Map(staff.map((employee) => [employee.id, employee])), [staff])
  const stationById = useMemo(() => new Map(stations.map((station) => [station.id, station])), [stations])
  const selectedStaff = selectedStaffId ? staffById.get(selectedStaffId) : null

  const displayAssignments = useMemo(
    () =>
      assignments.map((assignment) => ({
        ...assignment,
        profiles: staffById.get(assignment.employee_id),
        trainer: staffById.get(assignment.trainer_employee_id),
      })),
    [assignments, staffById],
  )

  const assignedByEmployeeId = useMemo(() => {
    return new Map(displayAssignments.map((assignment) => [assignment.employee_id, assignment]))
  }, [displayAssignments])
  const selectedStaffAssignment = selectedStaffId ? assignedByEmployeeId.get(selectedStaffId) : null

  const staffOptions = useMemo(
    () =>
      staff.map((employee) => {
        const assignedAssignment = assignedByEmployeeId.get(employee.id)
        const isCurrentEditEmployee = editingAssignment?.employee_id === employee.id
        return {
          value: employee.id,
          disabled: Boolean(assignedAssignment && !isCurrentEditEmployee),
          label: `${getFullName(employee)}${employee.employee_number ? ` (${employee.employee_number})` : ''}${
            assignedAssignment && !isCurrentEditEmployee ? ' - already scheduled' : ''
          }`,
        }
      }),
    [assignedByEmployeeId, editingAssignment?.employee_id, staff],
  )

  const trainerOptions = useMemo(() => {
    return displayAssignments
      .filter(
        (assignment) =>
          assignment.schedule_date === scheduleDate
          && assignment.branch_id === selectedStationId
          && assignment.station_role !== 'trainee'
          && assignment.employee_id !== selectedEmployee,
      )
      .map((assignment) => ({
        value: assignment.employee_id,
        label: `${getScheduleStaffName(assignment.profiles)} - ${getStationRoleLabel(assignment.station_role)}`,
      }))
  }, [displayAssignments, scheduleDate, selectedEmployee, selectedStationId])

  const stationGroups = useMemo(() => groupByStation(stations, displayAssignments), [displayAssignments, stations])
  const availableStaffCount = staff.length - assignedByEmployeeId.size
  const staffedStationCount = stationGroups.filter((group) => group.assignments.length > 0).length
  const needsAttentionCount = stationGroups.filter(
    (group) => group.assignments.length > 0 && group.assignments.length < MIN_STAFF_PER_STATION,
  ).length

  const monthStatsByDate = useMemo(() => {
    const stats = new Map()
    monthAssignments.forEach((assignment) => {
      const current = stats.get(assignment.schedule_date) ?? {
        staffCount: 0,
        stationIds: new Set(),
        roles: new Set(),
      }
      current.staffCount += 1
      current.stationIds.add(assignment.branch_id)
      current.roles.add(assignment.station_role)
      stats.set(assignment.schedule_date, current)
    })
    return stats
  }, [monthAssignments])

  const selectedDayReadiness = useMemo(() => {
    const ready = stationGroups.filter((group) => {
      const count = group.assignments.length
      return count >= MIN_STAFF_PER_STATION && count <= MAX_STAFF_PER_STATION
    }).length
    const empty = stationGroups.filter((group) => group.assignments.length === 0).length
    const needsStaff = stationGroups.filter(
      (group) => group.assignments.length > 0 && group.assignments.length < MIN_STAFF_PER_STATION,
    ).length

    return { ready, empty, needsStaff }
  }, [stationGroups])

  function openAssignmentModal({ assignment = null, stationId = null, employeeId = null, stationRole = 'cook' } = {}) {
    const defaultStationId = stationId ?? assignment?.branch_id ?? stations[0]?.id ?? null
    setEditingAssignment(assignment)
    setModalOpen(true)
    form.setFieldsValue({
      schedule_date: scheduleDate,
      branch_id: defaultStationId,
      employee_id: assignment?.employee_id ?? employeeId,
      station_role: assignment?.station_role ?? stationRole,
      scheduled_start: assignment?.scheduled_start?.slice(0, 5) ?? DEFAULT_SHIFT_START,
      scheduled_end: assignment?.scheduled_end?.slice(0, 5) ?? DEFAULT_SHIFT_END,
      trainer_employee_id: assignment?.trainer_employee_id,
      notes: assignment?.notes,
    })
  }

  function handlePickRole(stationId, stationRole = 'cook') {
    if (selectedStaffId && !assignedByEmployeeId.has(selectedStaffId)) {
      openAssignmentModal({ stationId, employeeId: selectedStaffId, stationRole })
      return
    }

    openAssignmentModal({ stationId, stationRole })
  }

  async function handleSave() {
    const values = await form.validateFields()
    const stationAssignmentCount = displayAssignments.filter(
      (assignment) => assignment.branch_id === values.branch_id && assignment.id !== editingAssignment?.id,
    ).length

    if (stationAssignmentCount >= MAX_STAFF_PER_STATION) {
      message.warning('This station already has 4 staff scheduled for the selected date.')
      return
    }

    setSaving(true)
    try {
      await saveStationScheduleAssignment(
        { ...values, schedule_date: scheduleDate },
        editingAssignment?.id,
      )
      message.success(editingAssignment ? 'Schedule assignment updated.' : 'Schedule assignment added.')
      setSelectedStaffId(null)
      setModalOpen(false)
      setEditingAssignment(null)
      form.resetFields()
      loadData(scheduleDate)
    } catch (error) {
      message.error(error.message || 'Unable to save assignment.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(assignmentId) {
    try {
      await deleteStationScheduleAssignment(assignmentId)
      message.success('Schedule assignment removed.')
      loadData(scheduleDate)
    } catch (error) {
      message.error(error.message || 'Unable to remove assignment.')
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Manager"
        title="Schedules"
        description="Build station schedules by day, station, role, and staff availability."
        actions={
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => loadData(scheduleDate)} loading={loading}>
              Refresh
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openAssignmentModal()}
              disabled={!stations.length}
            >
              Add assignment
            </Button>
          </Space>
        }
      />

      <Card className="schedule-toolbar-card">
        <Space wrap className="schedule-toolbar">
          <div>
            <Text type="secondary">Schedule date</Text>
            <Input
              type="date"
              value={scheduleDate}
              onChange={(event) => setScheduleDate(event.target.value || getTodayInputDate())}
            />
          </div>
          <div className="schedule-summary-pill">
            <CalendarOutlined />
            <span>{getCompactDateTitle(scheduleDate)}</span>
          </div>
          <div className="schedule-summary-pill">
            <TeamOutlined />
            <span>{assignments.length} staff assigned</span>
          </div>
          <div className="schedule-summary-pill">
            <CheckCircleOutlined />
            <span>{staffedStationCount} active stations staffed</span>
          </div>
          <div className={`schedule-summary-pill ${needsAttentionCount ? 'is-warning' : ''}`}>
            <ExclamationCircleOutlined />
            <span>{needsAttentionCount ? `${needsAttentionCount} stations need staff` : 'No staffing gaps'}</span>
          </div>
        </Space>
      </Card>

      <div className="schedule-planner-layout" aria-busy={loading}>
        <Card
          className="schedule-calendar-card"
          title={<span className="staff-card-title"><CalendarOutlined /> {getMonthTitle(scheduleDate)}</span>}
          extra={
            <Space size={4}>
              <Button
                type="text"
                icon={<LeftOutlined />}
                aria-label="Previous month"
                onClick={() => setScheduleDate(addMonths(scheduleDate, -1))}
              />
              <Button
                type="text"
                icon={<RightOutlined />}
                aria-label="Next month"
                onClick={() => setScheduleDate(addMonths(scheduleDate, 1))}
              />
            </Space>
          }
        >
          <div className="schedule-calendar-grid schedule-calendar-weekdays">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <Text key={day} type="secondary">{day}</Text>
            ))}
          </div>
          <div className="schedule-calendar-grid">
            {getCalendarDays(scheduleDate).map((day) => {
              const stats = monthStatsByDate.get(day.date)
              const isSelected = day.date === scheduleDate
              const isToday = day.date === getTodayInputDate()
              return (
                <button
                  type="button"
                  key={day.date}
                  className={`schedule-calendar-day ${day.isCurrentMonth ? '' : 'is-muted'} ${
                    isSelected ? 'is-selected' : ''
                  } ${stats ? 'has-schedule' : ''}`}
                  onClick={() => setScheduleDate(day.date)}
                >
                  <span>
                    {day.dayNumber}
                    {isToday && <em>Today</em>}
                  </span>
                  {stats && (
                    <small>{stats.stationIds.size} stations • {stats.staffCount} staff</small>
                  )}
                </button>
              )
            })}
          </div>
        </Card>

        <Card className="schedule-day-brief-card">
          <div className="schedule-day-brief-head">
            <Text className="attendance-kicker">Selected day</Text>
            <Typography.Title level={2}>{getSelectedDateTitle(scheduleDate)}</Typography.Title>
            <Text type="secondary">Assign available staff into station roles, then fine-tune shift time and trainer.</Text>
          </div>
          <div className="schedule-day-brief-grid">
            <div>
              <Text type="secondary">Staff assigned</Text>
              <strong>{assignments.length}</strong>
            </div>
            <div>
              <Text type="secondary">Ready stations</Text>
              <strong>{selectedDayReadiness.ready}</strong>
            </div>
            <div className={selectedDayReadiness.needsStaff ? 'is-warning' : ''}>
              <Text type="secondary">Needs staff</Text>
              <strong>{selectedDayReadiness.needsStaff}</strong>
            </div>
            <div>
              <Text type="secondary">Empty stations</Text>
              <strong>{selectedDayReadiness.empty}</strong>
            </div>
          </div>
        </Card>

        <AssignmentCommandCenter
          assignedByEmployeeId={assignedByEmployeeId}
          availableStaffCount={availableStaffCount}
          selectedStaff={selectedStaff}
          selectedStaffAssignment={selectedStaffAssignment}
          selectedStaffStation={stationById.get(selectedStaffAssignment?.branch_id)}
          selectedStaffId={selectedStaffId}
          stationGroups={stationGroups}
          staff={staff}
          onClearSelectedStaff={() => setSelectedStaffId(null)}
          onDeleteAssignment={handleDelete}
          onEditAssignment={(selectedAssignment) => openAssignmentModal({ assignment: selectedAssignment })}
          onPickRole={handlePickRole}
          onSelectStaff={setSelectedStaffId}
        />
      </div>

      <Modal
        title={editingAssignment ? 'Edit station assignment' : 'Add station assignment'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText={editingAssignment ? 'Save changes' : 'Add assignment'}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="branch_id" label="Station" rules={[{ required: true, message: 'Choose a station.' }]}>
            <Select
              options={stations.map((station) => ({
                value: station.id,
                label: getStationLabel(station),
              }))}
            />
          </Form.Item>
          <Form.Item name="employee_id" label="Staff" rules={[{ required: true, message: 'Choose a staff member.' }]}>
            <Select showSearch optionFilterProp="label" options={staffOptions} disabled={Boolean(editingAssignment)} />
          </Form.Item>
          <Form.Item name="station_role" label="Station role" rules={[{ required: true, message: 'Choose a role.' }]}>
            <Select options={STATION_ROLE_OPTIONS} onChange={() => form.setFieldValue('trainer_employee_id', null)} />
          </Form.Item>
          <Space className="form-grid-two" align="start">
            <Form.Item
              name="scheduled_start"
              label="Start time"
              rules={[{ required: true, message: 'Choose a start time.' }]}
            >
              <Input type="time" />
            </Form.Item>
            <Form.Item
              name="scheduled_end"
              label="End time"
              rules={[{ required: true, message: 'Choose an end time.' }]}
            >
              <Input type="time" />
            </Form.Item>
          </Space>
          {selectedRole === 'trainee' && (
            <Form.Item
              name="trainer_employee_id"
              label="Trainer"
              rules={[{ required: true, message: 'Choose the trainee trainer.' }]}
              extra="Trainer must already be assigned to the same station and date."
            >
              <Select showSearch optionFilterProp="label" options={trainerOptions} />
            </Form.Item>
          )}
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} placeholder="Optional manager notes" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
