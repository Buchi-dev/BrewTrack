import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  FieldTimeOutlined,
  HistoryOutlined,
  ReloadOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Image,
  Input,
  Row,
  Select,
  Segmented,
  Space,
  Statistic,
  Table,
  Tag,
  Timeline,
  Typography,
} from 'antd'
import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import { getAttendanceSelfieSignedUrls } from '../../services/attendanceService.js'
import {
  getManagerAttendanceDetails,
  listAttendanceEvents,
  listEmployeeAttendanceHistory,
  listManagerAttendanceRecords,
} from '../../services/manager/attendanceRecordsService.js'
import { listAllBranches } from '../../services/manager/branchService.js'
import { getFullName } from '../../services/manager/employeeService.js'
import { formatDate, formatDateTime } from '../../utils/date.js'

const { RangePicker } = DatePicker
const { Text } = Typography
const PAGE_SIZE = 10

const initialFilters = {
  page: 1,
  pageSize: PAGE_SIZE,
  search: '',
  branchId: null,
  status: null,
  startDate: null,
  endDate: null,
  missingClockOut: false,
}

const statusOptions = [
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'completed', label: 'Completed' },
  { value: 'incomplete', label: 'Incomplete' },
  { value: 'absent', label: 'Absent' },
  { value: 'excused', label: 'Excused' },
]

const followUpOptions = [{ value: 'missingClockOut', label: 'Missing clock-out' }]

function getStatusColor(record) {
  if (record?.status === 'completed') return 'green'
  if (record?.status === 'late' || record?.late_minutes > 0) return 'gold'
  if (record?.status === 'incomplete') return 'blue'
  if (record?.status === 'absent') return 'red'
  if (record?.status === 'excused') return 'purple'
  return 'default'
}

function getStatusLabel(record) {
  if (record?.status === 'incomplete' && record.clock_in_at && !record.clock_out_at) return 'Working'
  if (record?.status === 'completed') return 'Completed'
  if (record?.status === 'late' || record?.late_minutes > 0) return 'Late'
  return record?.status || 'Recorded'
}

function formatMinutes(value) {
  if (value == null) return '--'
  if (value < 60) return `${value} min`

  const hours = Math.floor(value / 60)
  const minutes = value % 60
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`
}

function formatEventLabel(eventType) {
  return eventType?.replaceAll('_', ' ') || 'attendance event'
}

function getEventColor(eventType) {
  if (eventType === 'clock_in') return 'green'
  if (eventType === 'clock_out') return 'blue'
  if (eventType === 'status_change') return 'gold'
  return 'gray'
}

function getEventSummary(event) {
  if (event.event_type === 'status_change') {
    return `${event.metadata?.old_status || '--'} to ${event.metadata?.new_status || '--'}`
  }

  if (event.event_type === 'clock_in' && Number(event.metadata?.late_minutes ?? 0) > 0) {
    return `${event.metadata.late_minutes} min late`
  }

  if (event.event_type === 'clock_out' && Number(event.metadata?.worked_minutes ?? 0) > 0) {
    return `Worked ${formatMinutes(event.metadata.worked_minutes)}`
  }

  if (event.event_type === 'attendance_note_added') return 'Note updated'

  return event.metadata?.status || 'Recorded'
}

function toDateFilterValue(value) {
  return value ? value.format('YYYY-MM-DD') : null
}

function SelfiePreview({ title, url, takenAt }) {
  return (
    <Card size="small" className="attendance-selfie-card" title={title}>
      {url ? (
        <Image src={url} alt={`${title} selfie`} className="attendance-selfie-image" />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No selfie attached" />
      )}
      <div className="table-subtext">{formatDateTime(takenAt)}</div>
    </Card>
  )
}

export default function ManagerAttendancePage() {
  const { message } = App.useApp()
  const [rows, setRows] = useState([])
  const [branches, setBranches] = useState([])
  const [count, setCount] = useState(0)
  const [filters, setFilters] = useState(initialFilters)
  const [loading, setLoading] = useState(true)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [selfieUrls, setSelfieUrls] = useState({})
  const [eventRows, setEventRows] = useState([])
  const [historyEmployee, setHistoryEmployee] = useState(null)
  const [historyRows, setHistoryRows] = useState([])
  const [historyCount, setHistoryCount] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)

  async function loadData(nextFilters = filters) {
    setLoading(true)
    try {
      const result = await listManagerAttendanceRecords(nextFilters)
      setRows(result.rows)
      setCount(result.count)
    } catch (error) {
      message.error(error.message || 'Unable to load attendance records.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      try {
        const [attendanceResult, branchRows] = await Promise.all([
          listManagerAttendanceRecords(initialFilters),
          listAllBranches(),
        ])

        if (!isMounted) return
        setRows(attendanceResult.rows)
        setCount(attendanceResult.count)
        setBranches(branchRows)
      } catch (error) {
        if (isMounted) message.error(error.message || 'Unable to load attendance records.')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadInitialData()

    return () => {
      isMounted = false
    }
  }, [message])

  const branchOptions = useMemo(
    () =>
      branches.map((branch) => ({
        value: branch.id,
        label: `${branch.name} (${branch.code})`,
      })),
    [branches],
  )

  const pageSummary = useMemo(
    () => ({
      total: count,
      working: rows.filter((record) => record.clock_in_at && !record.clock_out_at).length,
      late: rows.filter((record) => record.status === 'late' || Number(record.late_minutes ?? 0) > 0).length,
      missingClockOut: rows.filter((record) => record.clock_in_at && !record.clock_out_at).length,
    }),
    [count, rows],
  )

  const activeFilterCount = useMemo(
    () =>
      [
        filters.search,
        filters.branchId,
        filters.status,
        filters.startDate || filters.endDate,
        filters.missingClockOut,
      ].filter(Boolean).length,
    [filters],
  )

  function applyFilters(partial) {
    const nextFilters = { ...filters, page: 1, ...partial }
    setFilters(nextFilters)
    loadData(nextFilters)
  }

  function resetFilters() {
    setFilters(initialFilters)
    loadData(initialFilters)
  }

  function applyQuickView(value) {
    if (value === 'needsFollowUp') {
      applyFilters({ missingClockOut: true, status: null })
      return
    }

    if (value === 'late') {
      applyFilters({ missingClockOut: false, status: 'late' })
      return
    }

    if (value === 'completed') {
      applyFilters({ missingClockOut: false, status: 'completed' })
      return
    }

    applyFilters({ missingClockOut: false, status: null })
  }

  async function openDetails(record) {
    setSelectedRecord(record)
    setSelfieUrls({})
    setEventRows([])
    setDetailsLoading(true)

    try {
      const details = await getManagerAttendanceDetails(record.id)
      setSelectedRecord(details)
      setEventRows(await listAttendanceEvents(record.id))

      const paths = [details?.clock_in_photo_path, details?.clock_out_photo_path].filter(Boolean)
      if (paths.length) {
        const signedUrls = await getAttendanceSelfieSignedUrls(paths)
        setSelfieUrls(
          signedUrls.reduce((accumulator, item) => {
            accumulator[item.path] = item.signedUrl
            return accumulator
          }, {}),
        )
      }
    } catch (error) {
      message.error(error.message || 'Unable to load attendance details.')
    } finally {
      setDetailsLoading(false)
    }
  }

  async function loadHistory(employee, page = 1) {
    if (!employee?.id) return

    setHistoryLoading(true)
    try {
      const result = await listEmployeeAttendanceHistory({
        employeeId: employee.id,
        page,
        pageSize: PAGE_SIZE,
      })
      setHistoryRows(result.rows)
      setHistoryCount(result.count)
      setHistoryPage(page)
    } catch (error) {
      message.error(error.message || 'Unable to load employee attendance history.')
    } finally {
      setHistoryLoading(false)
    }
  }

  function openHistory(employee) {
    setHistoryEmployee(employee)
    loadHistory(employee, 1)
  }

  function handleTableChange(pagination) {
    const nextFilters = {
      ...filters,
      page: pagination.current,
      pageSize: pagination.pageSize,
    }
    setFilters(nextFilters)
    loadData(nextFilters)
  }

  const columns = [
    {
      title: 'Date',
      dataIndex: 'attendance_date',
      key: 'date',
      render: (value) => formatDate(value),
    },
    {
      title: 'Employee',
      dataIndex: 'profiles',
      key: 'employee',
      render: (profile) => (
        <div>
          <Text strong>{getFullName(profile)}</Text>
          {profile?.employee_number && <div className="table-subtext">{profile.employee_number}</div>}
        </div>
      ),
    },
    {
      title: 'Station',
      dataIndex: 'branches',
      key: 'branch',
      responsive: ['md'],
      render: (branch) => branch?.name || '--',
    },
    {
      title: 'Clock in',
      dataIndex: 'clock_in_at',
      key: 'clockIn',
      render: (value) => formatDateTime(value, { dateStyle: undefined }),
    },
    {
      title: 'Clock out',
      dataIndex: 'clock_out_at',
      key: 'clockOut',
      responsive: ['sm'],
      render: (value) => formatDateTime(value, { dateStyle: undefined }),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => <Tag color={getStatusColor(record)}>{getStatusLabel(record)}</Tag>,
    },
    {
      title: 'Late',
      dataIndex: 'late_minutes',
      key: 'late',
      responsive: ['lg'],
      render: (value) => formatMinutes(value),
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, record) => (
        <Space wrap>
          <Button icon={<HistoryOutlined />} onClick={() => openHistory(record.profiles)}>
            History
          </Button>
          <Button type="primary" icon={<EyeOutlined />} onClick={() => openDetails(record)}>
            Details
          </Button>
        </Space>
      ),
    },
  ]

  const historyColumns = [
    {
      title: 'Date',
      dataIndex: 'attendance_date',
      key: 'date',
      render: (value) => formatDate(value),
    },
    {
      title: 'Station',
      dataIndex: 'branches',
      key: 'branch',
      responsive: ['md'],
      render: (branch) => branch?.name || '--',
    },
    {
      title: 'Clock in',
      dataIndex: 'clock_in_at',
      key: 'clockIn',
      render: (value) => formatDateTime(value, { dateStyle: undefined }),
    },
    {
      title: 'Clock out',
      dataIndex: 'clock_out_at',
      key: 'clockOut',
      responsive: ['sm'],
      render: (value) => formatDateTime(value, { dateStyle: undefined }),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => <Tag color={getStatusColor(record)}>{getStatusLabel(record)}</Tag>,
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Manager"
        title="Attendance records"
        description="Search, filter, and inspect selfie-backed attendance entries."
        actions={
          <Button icon={<ReloadOutlined />} onClick={() => loadData(filters)} loading={loading}>
            Refresh
          </Button>
        }
      />

      <Card>
        <div className="manager-control-panel">
          <div>
            <Text className="attendance-kicker">Quick view</Text>
            <Segmented
              value={
                filters.missingClockOut
                  ? 'needsFollowUp'
                  : filters.status === 'late' || filters.status === 'completed'
                    ? filters.status
                    : 'all'
              }
              onChange={applyQuickView}
              options={[
                { label: 'All', value: 'all' },
                { label: 'Needs follow-up', value: 'needsFollowUp' },
                { label: 'Late', value: 'late' },
                { label: 'Completed', value: 'completed' },
              ]}
            />
          </div>
          <Space wrap className="manager-filter-note">
            <Tag color={activeFilterCount ? 'gold' : 'default'}>{activeFilterCount} active filters</Tag>
            <Text type="secondary">{count} matching records</Text>
          </Space>
        </div>

        {pageSummary.missingClockOut > 0 && (
          <Alert
            className="manager-page-alert"
            type="warning"
            showIcon
            title={`${pageSummary.missingClockOut} visible record${pageSummary.missingClockOut === 1 ? '' : 's'} need clock-out review`}
            description="Open details to confirm the selfie evidence and event trail before end-of-day cleanup."
          />
        )}

        <Row gutter={[12, 12]} className="manager-summary-grid">
          <Col xs={12} md={6}>
            <Card size="small" className="manager-summary-card">
              <Statistic title="Records" value={pageSummary.total} prefix={<FieldTimeOutlined />} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" className="manager-summary-card">
              <Statistic title="Working" value={pageSummary.working} prefix={<ClockCircleOutlined />} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" className="manager-summary-card">
              <Statistic title="Late" value={pageSummary.late} prefix={<WarningOutlined />} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" className="manager-summary-card">
              <Statistic title="Completed" value={rows.filter((record) => record.status === 'completed').length} prefix={<CheckCircleOutlined />} />
            </Card>
          </Col>
        </Row>

        <Space wrap className="table-toolbar">
          <Input.Search
            prefix={<SearchOutlined />}
            placeholder="Employee name or number"
            allowClear
            enterButton
            onSearch={(value) => applyFilters({ search: value })}
            style={{ minWidth: 280 }}
          />
          <RangePicker
            allowClear
            suffixIcon={<CalendarOutlined />}
            onChange={(value) =>
              applyFilters({
                startDate: toDateFilterValue(value?.[0]),
                endDate: toDateFilterValue(value?.[1]),
              })
            }
          />
          <Select
            placeholder="Station"
            allowClear
            showSearch
            optionFilterProp="label"
            options={branchOptions}
            value={filters.branchId}
            onChange={(value) => applyFilters({ branchId: value ?? null })}
            style={{ minWidth: 220 }}
          />
          <Select
            placeholder="Status"
            allowClear
            options={statusOptions}
            value={filters.status}
            onChange={(value) => applyFilters({ status: value ?? null })}
            style={{ minWidth: 160 }}
          />
          <Select
            placeholder="Follow-up"
            allowClear
            options={followUpOptions}
            value={filters.missingClockOut ? 'missingClockOut' : null}
            onChange={(value) => applyFilters({ missingClockOut: value === 'missingClockOut' })}
            style={{ minWidth: 190 }}
          />
          <Button onClick={resetFilters}>Reset</Button>
        </Space>

        <Table
          columns={columns}
          dataSource={rows}
          loading={loading}
          rowKey="id"
          scroll={{ x: 980 }}
          pagination={{ current: filters.page, pageSize: filters.pageSize, total: count, showSizeChanger: true }}
          onChange={handleTableChange}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No attendance records match this view"
              />
            ),
          }}
        />
      </Card>

      <Drawer
        title="Attendance details"
        open={Boolean(selectedRecord)}
        onClose={() => setSelectedRecord(null)}
        width={720}
      >
        <Space direction="vertical" size={18} className="full-width">
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Employee">{getFullName(selectedRecord?.profiles)}</Descriptions.Item>
            <Descriptions.Item label="Employee no.">
              {selectedRecord?.profiles?.employee_number || '--'}
            </Descriptions.Item>
            <Descriptions.Item label="Station">{selectedRecord?.branches?.name || '--'}</Descriptions.Item>
            <Descriptions.Item label="Attendance date">{formatDate(selectedRecord?.attendance_date)}</Descriptions.Item>
            <Descriptions.Item label="Clock in">{formatDateTime(selectedRecord?.clock_in_at)}</Descriptions.Item>
            <Descriptions.Item label="Clock out">{formatDateTime(selectedRecord?.clock_out_at)}</Descriptions.Item>
            <Descriptions.Item label="Scheduled start">
              {formatDateTime(selectedRecord?.scheduled_start)}
            </Descriptions.Item>
            <Descriptions.Item label="Scheduled end">{formatDateTime(selectedRecord?.scheduled_end)}</Descriptions.Item>
            <Descriptions.Item label="Late minutes">{formatMinutes(selectedRecord?.late_minutes)}</Descriptions.Item>
            <Descriptions.Item label="Worked time">{formatMinutes(selectedRecord?.worked_minutes)}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={getStatusColor(selectedRecord)}>{getStatusLabel(selectedRecord)}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Notes">{selectedRecord?.notes || '--'}</Descriptions.Item>
          </Descriptions>

          <div className="attendance-selfie-grid" aria-busy={detailsLoading}>
            <SelfiePreview
              title="Clock-in selfie"
              url={selfieUrls[selectedRecord?.clock_in_photo_path]}
              takenAt={selectedRecord?.clock_in_at}
            />
            <SelfiePreview
              title="Clock-out selfie"
              url={selfieUrls[selectedRecord?.clock_out_photo_path]}
              takenAt={selectedRecord?.clock_out_at}
            />
          </div>

          <Card size="small" title="Event history" loading={detailsLoading}>
            {eventRows.length ? (
              <Timeline
                items={eventRows.map((event) => ({
                  color: getEventColor(event.event_type),
                  children: (
                    <div>
                      <Text strong className="text-capitalize">
                        {formatEventLabel(event.event_type)}
                      </Text>
                      <div className="table-subtext">{formatDateTime(event.created_at)}</div>
                      <div>{getEventSummary(event)}</div>
                    </div>
                  ),
                }))}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No event history yet" />
            )}
          </Card>

          <Button
            icon={<HistoryOutlined />}
            onClick={() => openHistory(selectedRecord?.profiles)}
            disabled={!selectedRecord?.profiles?.id}
            loading={detailsLoading}
          >
            View employee history
          </Button>
        </Space>
      </Drawer>

      <Drawer
        title={historyEmployee ? `${getFullName(historyEmployee)} history` : 'Employee attendance history'}
        open={Boolean(historyEmployee)}
        onClose={() => setHistoryEmployee(null)}
        width={760}
      >
        <Table
          columns={historyColumns}
          dataSource={historyRows}
          loading={historyLoading}
          rowKey="id"
          scroll={{ x: 720 }}
          pagination={{
            current: historyPage,
            pageSize: PAGE_SIZE,
            total: historyCount,
            showSizeChanger: false,
          }}
          onChange={(pagination) => loadHistory(historyEmployee, pagination.current)}
        />
      </Drawer>
    </>
  )
}
