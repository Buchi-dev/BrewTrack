import {
  CalendarOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  FieldTimeOutlined,
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
  Input,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import {
  listDailyAttendanceReport,
  listEmployeeAttendanceReport,
  listLateAttendanceReport,
  listMissingClockOutReport,
  listMonthlyAttendanceReport,
} from '../../services/manager/attendanceRecordsService.js'
import { logManagerAction } from '../../services/manager/auditService.js'
import { listAllBranches } from '../../services/manager/branchService.js'
import { getFullName, listEmployees } from '../../services/manager/employeeService.js'
import { formatDate, formatDateTime } from '../../utils/date.js'

const { RangePicker } = DatePicker
const { Text } = Typography

const PAGE_SIZE = 10
const EXPORT_LIMIT = 5000
const today = dayjs()

const reportTypes = [
  { value: 'daily', label: 'Daily' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'employee', label: 'Employee' },
  { value: 'late', label: 'Late' },
  { value: 'missingClockOut', label: 'Missing clock-out' },
]

const initialFilters = {
  reportType: 'daily',
  page: 1,
  pageSize: PAGE_SIZE,
  date: today.format('YYYY-MM-DD'),
  monthStart: today.startOf('month').format('YYYY-MM-DD'),
  monthEnd: today.endOf('month').format('YYYY-MM-DD'),
  startDate: today.startOf('month').format('YYYY-MM-DD'),
  endDate: today.endOf('month').format('YYYY-MM-DD'),
  employeeId: null,
  search: '',
  branchId: null,
}

function formatMinutes(value) {
  if (value == null) return '--'
  if (value < 60) return `${value} min`

  const hours = Math.floor(value / 60)
  const minutes = value % 60
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`
}

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

function getReportTitle(reportType) {
  return reportTypes.find((option) => option.value === reportType)?.label || 'Report'
}

function getDateRange(filters) {
  if (filters.reportType === 'daily') return { date: filters.date }
  if (filters.reportType === 'monthly') return { startDate: filters.monthStart, endDate: filters.monthEnd }
  return { startDate: filters.startDate, endDate: filters.endDate }
}

function buildReportRequest(filters, overrides = {}) {
  const nextFilters = { ...filters, ...overrides }
  const baseRequest = {
    page: nextFilters.page,
    pageSize: nextFilters.pageSize,
    search: nextFilters.search,
    branchId: nextFilters.branchId,
    ...getDateRange(nextFilters),
  }

  if (nextFilters.reportType === 'employee') {
    baseRequest.employeeId = nextFilters.employeeId
  }

  return baseRequest
}

function getReportLoader(reportType) {
  if (reportType === 'monthly') return listMonthlyAttendanceReport
  if (reportType === 'employee') return listEmployeeAttendanceReport
  if (reportType === 'late') return listLateAttendanceReport
  if (reportType === 'missingClockOut') return listMissingClockOutReport
  return listDailyAttendanceReport
}

function calculateSummary(rows, count) {
  return {
    total: count,
    completed: rows.filter((record) => record.status === 'completed').length,
    late: rows.filter((record) => Number(record.late_minutes ?? 0) > 0 || record.status === 'late').length,
    missingClockOut: rows.filter((record) => record.clock_in_at && !record.clock_out_at).length,
    workedMinutes: rows.reduce((total, record) => total + Number(record.worked_minutes ?? 0), 0),
  }
}

function escapeCsvCell(value) {
  const text = value == null || value === '' ? '--' : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function toCsvRows(rows) {
  return [
    [
      'Attendance Date',
      'Employee',
      'Employee Number',
      'Station',
      'Clock In',
      'Clock Out',
      'Status',
      'Late Minutes',
      'Worked Minutes',
      'Notes',
    ],
    ...rows.map((record) => [
      formatDate(record.attendance_date),
      getFullName(record.profiles),
      record.profiles?.employee_number || '',
      record.branches?.name || '',
      formatDateTime(record.clock_in_at),
      formatDateTime(record.clock_out_at),
      getStatusLabel(record),
      record.late_minutes ?? '',
      record.worked_minutes ?? '',
      record.notes || '',
    ]),
  ]
}

export default function ManagerReportsPage() {
  const { message } = App.useApp()
  const [rows, setRows] = useState([])
  const [count, setCount] = useState(0)
  const [branches, setBranches] = useState([])
  const [employees, setEmployees] = useState([])
  const [filters, setFilters] = useState(initialFilters)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  async function loadReport(nextFilters = filters) {
    setLoading(true)
    try {
      const loader = getReportLoader(nextFilters.reportType)
      const result = await loader(buildReportRequest(nextFilters))
      setRows(result.rows)
      setCount(result.count)
    } catch (error) {
      message.error(error.message || 'Unable to load report.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      try {
        const [reportResult, branchRows, employeeResult] = await Promise.all([
          listDailyAttendanceReport(buildReportRequest(initialFilters)),
          listAllBranches(),
          listEmployees({ page: 1, pageSize: 100, status: 'active' }),
        ])

        if (!isMounted) return
        setRows(reportResult.rows)
        setCount(reportResult.count)
        setBranches(branchRows)
        setEmployees(employeeResult.rows)
      } catch (error) {
        if (isMounted) message.error(error.message || 'Unable to load reports.')
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

  const employeeOptions = useMemo(
    () =>
      employees.map((employee) => ({
        value: employee.id,
        label: employee.employee_number
          ? `${getFullName(employee)} (${employee.employee_number})`
          : getFullName(employee),
      })),
    [employees],
  )

  const summary = useMemo(() => calculateSummary(rows, count), [rows, count])

  function applyFilters(partial) {
    const nextFilters = { ...filters, page: 1, ...partial }
    setFilters(nextFilters)
    loadReport(nextFilters)
  }

  function resetFilters() {
    setFilters(initialFilters)
    loadReport(initialFilters)
  }

  function handleTableChange(pagination) {
    const nextFilters = {
      ...filters,
      page: pagination.current,
      pageSize: pagination.pageSize,
    }
    setFilters(nextFilters)
    loadReport(nextFilters)
  }

  async function exportCsv() {
    setExporting(true)
    try {
      const loader = getReportLoader(filters.reportType)
      const result = await loader(
        buildReportRequest(filters, {
          page: 1,
          pageSize: EXPORT_LIMIT,
        }),
      )
      const filename = `brewtrack-${filters.reportType}-report-${dayjs().format('YYYY-MM-DD-HHmm')}.csv`
      downloadCsv(filename, toCsvRows(result.rows))
      await logManagerAction({
        action: 'report_exported',
        resourceType: 'reports',
        metadata: {
          reportType: filters.reportType,
          exportedRows: result.rows.length,
          filters: buildReportRequest(filters, {
            page: 1,
            pageSize: EXPORT_LIMIT,
          }),
        },
      })
      message.success(`Exported ${result.rows.length} report rows.`)
    } catch (error) {
      message.error(error.message || 'Unable to export report.')
    } finally {
      setExporting(false)
    }
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
      title: 'Worked',
      dataIndex: 'worked_minutes',
      key: 'worked',
      responsive: ['lg'],
      render: (value) => formatMinutes(value),
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Manager"
        title="Reports"
        description="Generate daily, monthly, employee, late, and missing clock-out reports."
        actions={
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => loadReport(filters)} loading={loading}>
              Refresh
            </Button>
            <Button type="primary" icon={<DownloadOutlined />} onClick={exportCsv} loading={exporting}>
              Export CSV
            </Button>
          </Space>
        }
      />

      <Card>
        <div className="manager-control-panel">
          <div>
            <Text className="attendance-kicker">Report view</Text>
            <Segmented
              value={filters.reportType}
              onChange={(value) => applyFilters({ reportType: value })}
              options={reportTypes}
            />
          </div>
          <Space wrap className="manager-filter-note">
            <Tag color="blue">{getReportTitle(filters.reportType)}</Tag>
            <Text type="secondary">{count} rows available</Text>
          </Space>
        </div>

        <Alert
          className="manager-page-alert"
          type="info"
          showIcon
          title="Exports use the current report view and filters"
          description="Set the date range, station, employee, and search first, then export the exact CSV the manager needs."
        />

        <Space wrap className="table-toolbar">
          {filters.reportType === 'daily' && (
            <DatePicker
              allowClear={false}
              suffixIcon={<CalendarOutlined />}
              value={dayjs(filters.date)}
              onChange={(value) => applyFilters({ date: value.format('YYYY-MM-DD') })}
            />
          )}

          {filters.reportType === 'monthly' && (
            <DatePicker
              allowClear={false}
              picker="month"
              suffixIcon={<CalendarOutlined />}
              value={dayjs(filters.monthStart)}
              onChange={(value) =>
                applyFilters({
                  monthStart: value.startOf('month').format('YYYY-MM-DD'),
                  monthEnd: value.endOf('month').format('YYYY-MM-DD'),
                })
              }
            />
          )}

          {['employee', 'late', 'missingClockOut'].includes(filters.reportType) && (
            <RangePicker
              allowClear={false}
              suffixIcon={<CalendarOutlined />}
              value={[dayjs(filters.startDate), dayjs(filters.endDate)]}
              onChange={(value) =>
                applyFilters({
                  startDate: value[0].format('YYYY-MM-DD'),
                  endDate: value[1].format('YYYY-MM-DD'),
                })
              }
            />
          )}

          {filters.reportType === 'employee' && (
            <Select
              placeholder="Employee"
              allowClear
              showSearch
              optionFilterProp="label"
              options={employeeOptions}
              value={filters.employeeId}
              onChange={(value) => applyFilters({ employeeId: value ?? null })}
              style={{ minWidth: 280 }}
            />
          )}

          <Input.Search
            prefix={<SearchOutlined />}
            placeholder="Employee name or number"
            allowClear
            enterButton
            onSearch={(value) => applyFilters({ search: value })}
            style={{ minWidth: 270 }}
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

          <Button onClick={resetFilters}>Reset</Button>
        </Space>

        <Row gutter={[16, 16]} className="summary-grid">
          <Col xs={12} md={6}>
            <Card size="small" className="manager-summary-card">
              <Statistic title={`${getReportTitle(filters.reportType)} records`} value={summary.total} prefix={<FieldTimeOutlined />} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" className="manager-summary-card">
              <Statistic title="Completed on page" value={summary.completed} prefix={<CheckCircleOutlined />} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" className="manager-summary-card">
              <Statistic title="Late records on page" value={summary.late} prefix={<WarningOutlined />} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" className="manager-summary-card">
              <Statistic title="Missing clock-outs on page" value={summary.missingClockOut} />
            </Card>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={rows}
          loading={loading}
          rowKey="id"
          scroll={{ x: 980 }}
          pagination={{ current: filters.page, pageSize: filters.pageSize, total: count, showSizeChanger: true }}
          onChange={handleTableChange}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={7}>
                Worked time on this page
              </Table.Summary.Cell>
              <Table.Summary.Cell index={7}>{formatMinutes(summary.workedMinutes)}</Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </Card>
    </>
  )
}
