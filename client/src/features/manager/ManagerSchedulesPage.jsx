import {
  CalendarOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  TeamOutlined,
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
  formatScheduleTimeRange,
  getScheduleStaffName,
  getStationLabel,
  getStationRoleLabel,
  listStationScheduleAssignments,
  saveStationScheduleAssignment,
  STATION_ROLE_OPTIONS,
} from '../../services/manager/stationScheduleService.js'

const { Text } = Typography

function getTodayInputDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function groupByStation(stations, assignments) {
  return stations.map((station) => ({
    station,
    assignments: assignments.filter((assignment) => assignment.branch_id === station.id),
  }))
}

function StaffAssignment({ assignment, onEdit, onDelete }) {
  return (
    <div className="schedule-assignment">
      <div className="schedule-assignment-main">
        <Text strong>{getScheduleStaffName(assignment.profiles)}</Text>
        {assignment.profiles?.employee_number && (
          <Text type="secondary" className="schedule-assignment-meta">
            {assignment.profiles.employee_number}
          </Text>
        )}
        <Space wrap size={[6, 6]}>
          <Tag color={assignment.station_role === 'trainee' ? 'gold' : 'blue'}>
            {getStationRoleLabel(assignment.station_role)}
          </Tag>
          <Tag color="purple">
            {formatScheduleTimeRange(assignment.scheduled_start, assignment.scheduled_end)}
          </Tag>
          {assignment.trainer && (
            <Tag color="green">Trainer: {getScheduleStaffName(assignment.trainer)}</Tag>
          )}
        </Space>
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

export default function ManagerSchedulesPage() {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [scheduleDate, setScheduleDate] = useState(getTodayInputDate())
  const [assignments, setAssignments] = useState([])
  const [stations, setStations] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState(null)
  const selectedRole = Form.useWatch('station_role', form)
  const selectedStationId = Form.useWatch('branch_id', form)
  const selectedEmployee = Form.useWatch('employee_id', form)

  async function loadData(date = scheduleDate) {
    setLoading(true)
    try {
      const [assignmentRows, stationRows, staffRows] = await Promise.all([
        listStationScheduleAssignments(date),
        listAllBranches(),
        listActiveStaff(),
      ])
      setAssignments(assignmentRows)
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
      try {
        const [assignmentRows, stationRows, staffRows] = await Promise.all([
          listStationScheduleAssignments(scheduleDate),
          listAllBranches(),
          listActiveStaff(),
        ])
        if (!isMounted) return
        setAssignments(assignmentRows)
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

  const staffOptions = useMemo(
    () =>
      staff.map((employee) => ({
        value: employee.id,
        label: `${getFullName(employee)}${employee.employee_number ? ` (${employee.employee_number})` : ''}`,
      })),
    [staff],
  )

  const staffById = useMemo(() => {
    return new Map(staff.map((employee) => [employee.id, employee]))
  }, [staff])

  const displayAssignments = useMemo(
    () =>
      assignments.map((assignment) => ({
        ...assignment,
        profiles: staffById.get(assignment.employee_id),
        trainer: staffById.get(assignment.trainer_employee_id),
      })),
    [assignments, staffById],
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
  const assignedCount = assignments.length

  function openAssignmentModal(assignment = null, stationId = null) {
    const defaultStationId = stationId ?? stations[0]?.id ?? null
    setEditingAssignment(assignment)
    setModalOpen(true)
    form.setFieldsValue({
      schedule_date: scheduleDate,
      branch_id: assignment?.branch_id ?? defaultStationId,
      employee_id: assignment?.employee_id,
      station_role: assignment?.station_role ?? 'cook',
      scheduled_start: assignment?.scheduled_start?.slice(0, 5) ?? '07:00',
      scheduled_end: assignment?.scheduled_end?.slice(0, 5) ?? '18:00',
      trainer_employee_id: assignment?.trainer_employee_id,
      notes: assignment?.notes,
    })
  }

  async function handleSave() {
    const values = await form.validateFields()
    setSaving(true)
    try {
      await saveStationScheduleAssignment(
        { ...values, schedule_date: scheduleDate },
        editingAssignment?.id,
      )
      message.success(editingAssignment ? 'Schedule assignment updated.' : 'Schedule assignment added.')
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
        description="Assign active staff to the stations created on the Stations page for the selected work date."
        actions={
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => loadData(scheduleDate)} loading={loading}>
              Refresh
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openAssignmentModal()} disabled={!stations.length}>
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
            <span>{assignedCount} staff assigned</span>
          </div>
          <div className="schedule-summary-pill">
            <TeamOutlined />
            <span>3 to 4 staff per station recommended</span>
          </div>
        </Space>
      </Card>

      {stations.length ? (
        <div className="station-schedule-grid" aria-busy={loading}>
          {stationGroups.map(({ station, assignments: stationAssignments }) => (
          <Card
            key={station.id}
            className="station-schedule-card"
            title={
              <Space>
                <span>{getStationLabel(station)}</span>
                <Tag color={stationAssignments.length >= 3 && stationAssignments.length <= 4 ? 'green' : 'gold'}>
                  {stationAssignments.length}/4
                </Tag>
              </Space>
            }
            extra={
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() => openAssignmentModal(null, station.id)}
                disabled={stationAssignments.length >= 4}
              >
                Assign
              </Button>
            }
          >
            {stationAssignments.length ? (
              <div className="schedule-assignment-list">
                {stationAssignments.map((assignment) => (
                  <StaffAssignment
                    key={assignment.id}
                    assignment={assignment}
                    onEdit={openAssignmentModal}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No staff assigned" />
            )}
          </Card>
          ))}
        </div>
      ) : (
        <Card className="station-schedule-card">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Create an active station first" />
        </Card>
      )}

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
            <Select showSearch optionFilterProp="label" options={staffOptions} />
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
