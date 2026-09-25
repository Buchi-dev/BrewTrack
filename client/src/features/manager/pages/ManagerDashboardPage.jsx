import {
  BankOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FileSearchOutlined,
  PlusOutlined,
  TeamOutlined,
  UserAddOutlined,
} from '@ant-design/icons'
import { App, Button, Card, Col, Empty, Flex, Grid, List, Progress, Row, Space, Table, Tag, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../../components/common/PageHeader.jsx'
import { BRAND } from '../../../constants/brand.js'
import { ROUTES } from '../../../constants/routes.js'
import { getManagerDashboardSummary, getManagerTodayAttendance } from '../../../services/manager/dashboardService.js'
import { getFullName } from '../../../services/manager/employeeService.js'
import { formatDateTime } from '../../../utils/date.js'

const { Text, Title } = Typography

const defaultSummary = {
  totalEmployees: 0,
  presentToday: 0,
  lateToday: 0,
  notYetClockedIn: 0,
  currentlyWorking: 0,
  completedShifts: 0,
  missingClockOut: 0,
}

function getStatusColor(record) {
  if (record.status === 'completed') return 'green'
  if (record.status === 'late' || record.late_minutes > 0) return 'gold'
  if (record.status === 'incomplete') return 'blue'
  if (record.status === 'absent') return 'red'
  return 'default'
}

function getStatusLabel(record) {
  if (record.status === 'incomplete' && record.clock_in_at && !record.clock_out_at) return 'Working'
  if (record.status === 'completed') return 'Completed'
  if (record.status === 'late' || record.late_minutes > 0) return 'Late'
  return record.status || 'Recorded'
}

function MetricCard({ title, value, helper, icon, tone = 'neutral' }) {
  return (
    <Card className={`metric-card metric-card-${tone}`}>
      <Flex align="flex-start" justify="space-between" gap={16}>
        <div>
          <Text type="secondary">{title}</Text>
          <div className="metric-value">{value}</div>
          {helper && <div className="metric-helper">{helper}</div>}
        </div>
        <div className="metric-icon" aria-hidden="true">
          {icon}
        </div>
      </Flex>
    </Card>
  )
}

function NextStepCard({ icon, title, description, action }) {
  return (
    <Card className="next-step-card">
      <Space align="start" size={12}>
        <div className="next-step-icon" aria-hidden="true">
          {icon}
        </div>
        <div>
          <Text strong>{title}</Text>
          <p>{description}</p>
          {action}
        </div>
      </Space>
    </Card>
  )
}

function AttendanceEmptyState({ onAddEmployee, onOpenAttendance }) {
  return (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <div className="dashboard-empty-copy">
          <Text strong>No attendance records yet today</Text>
          <Text type="secondary">
            Once staff clock in, their branch, time in, time out, and status will appear here.
          </Text>
        </div>
      }
    >
      <Space wrap>
        <Button type="primary" icon={<PlusOutlined />} onClick={onAddEmployee}>
          Add employee
        </Button>
        <Button icon={<FileSearchOutlined />} onClick={onOpenAttendance}>
          Open attendance
        </Button>
      </Space>
    </Empty>
  )
}

export default function ManagerDashboardPage() {
  const navigate = useNavigate()
  const screens = Grid.useBreakpoint()
  const { message } = App.useApp()
  const [summary, setSummary] = useState(defaultSummary)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadSummary() {
      try {
        const [data, todayRecords] = await Promise.all([getManagerDashboardSummary(), getManagerTodayAttendance()])

        if (!isMounted) return
        if (data?.error === 'forbidden') {
          message.error('Your account cannot view the manager dashboard.')
          setSummary(defaultSummary)
          return
        }

        setSummary({ ...defaultSummary, ...(data ?? {}) })
        setRecords(todayRecords)
      } catch (error) {
        if (isMounted) {
          message.error(error.message || 'Unable to load dashboard summary.')
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadSummary()

    return () => {
      isMounted = false
    }
  }, [message])

  const columns = useMemo(
    () => [
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
        title: 'Branch',
        dataIndex: 'branches',
        key: 'branch',
        responsive: ['md'],
        render: (branch) => branch?.name || '--',
      },
      {
        title: 'Time in',
        dataIndex: 'clock_in_at',
        key: 'clockIn',
        render: (value) => formatDateTime(value, { dateStyle: undefined }),
      },
      {
        title: 'Time out',
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
    ],
    [],
  )

  const completionPercent = useMemo(() => {
    if (!summary.totalEmployees) return 0
    return Math.round((summary.presentToday / summary.totalEmployees) * 100)
  }, [summary.presentToday, summary.totalEmployees])
  const isPhoneLayout = !screens.md

  return (
    <>
      <PageHeader
        eyebrow="Manager"
        title="Today at a glance"
        description="Track who is in, who still needs attention, and what needs follow-up before the shift ends."
        actions={
          <Space wrap>
            <Button icon={<TeamOutlined />} onClick={() => navigate(ROUTES.managerEmployees)}>
              Employees
            </Button>
            <Button type="primary" icon={<CalendarOutlined />} onClick={() => navigate(ROUTES.managerAttendance)}>
              View attendance
            </Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]} className="dashboard-metrics">
        <Col xs={24} md={12} xl={6}>
          <MetricCard
            title="Total employees"
            value={summary.totalEmployees}
            helper="Active staff accounts"
            icon={<TeamOutlined />}
          />
        </Col>
        <Col xs={24} md={12} xl={6}>
          <MetricCard
            title="Present today"
            value={summary.presentToday}
            helper={`${completionPercent}% checked in`}
            icon={<UserAddOutlined />}
            tone="success"
          />
        </Col>
        <Col xs={24} md={12} xl={6}>
          <MetricCard
            title="Late today"
            value={summary.lateToday}
            helper="Past scheduled start"
            icon={<ClockCircleOutlined />}
            tone={summary.lateToday > 0 ? 'warning' : 'neutral'}
          />
        </Col>
        <Col xs={24} md={12} xl={6}>
          <MetricCard
            title="Missing clock-out"
            value={summary.missingClockOut}
            helper="Needs end-of-day review"
            icon={<ExclamationCircleOutlined />}
            tone={summary.missingClockOut > 0 ? 'danger' : 'neutral'}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="section-card">
        <Col xs={24} lg={16}>
          <Card
            className="dashboard-table-card"
            title={
              <Flex align="center" justify="space-between" gap={12} wrap>
                <span>Today&apos;s attendance</span>
                <Tag color={summary.notYetClockedIn > 0 ? 'gold' : 'green'}>
                  {summary.notYetClockedIn} not yet clocked in
                </Tag>
              </Flex>
            }
          >
            {isPhoneLayout ? (
              <div className="mobile-attendance-panel" aria-busy={loading}>
                {records.length ? (
                  <List
                    loading={loading}
                    dataSource={records}
                    renderItem={(record) => (
                      <List.Item>
                        <List.Item.Meta
                          title={getFullName(record.profiles)}
                          description={`${record.branches?.name || 'No branch'} • ${formatDateTime(record.clock_in_at, {
                            dateStyle: undefined,
                          })}`}
                        />
                        <Tag color={getStatusColor(record)}>{getStatusLabel(record)}</Tag>
                      </List.Item>
                    )}
                  />
                ) : (
                  <AttendanceEmptyState
                    onAddEmployee={() => navigate(ROUTES.managerEmployees)}
                    onOpenAttendance={() => navigate(ROUTES.managerAttendance)}
                  />
                )}
              </div>
            ) : (
              <Table
                columns={columns}
                dataSource={records}
                loading={loading}
                pagination={{ pageSize: 8, hideOnSinglePage: true }}
                rowKey="id"
                locale={{
                  emptyText: (
                    <AttendanceEmptyState
                      onAddEmployee={() => navigate(ROUTES.managerEmployees)}
                      onOpenAttendance={() => navigate(ROUTES.managerAttendance)}
                    />
                  ),
                }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card className="operations-card">
            <Text className="eyebrow">Operations</Text>
            <Title level={3}>Shift completion</Title>
            <Progress percent={completionPercent} strokeColor={BRAND.colors.amber} />
            <div className="operations-list">
              <div>
                <Text type="secondary">Currently working</Text>
                <strong>{summary.currentlyWorking}</strong>
              </div>
              <div>
                <Text type="secondary">Completed shifts</Text>
                <strong>{summary.completedShifts}</strong>
              </div>
            </div>
          </Card>

          <NextStepCard
            icon={<BankOutlined />}
            title="Set up branches"
            description="Keep staff assignments clear so attendance records are easy to filter later."
            action={
              <Button size="small" onClick={() => navigate(ROUTES.managerBranches)}>
                Manage branches
              </Button>
            }
          />
        </Col>
      </Row>
    </>
  )
}
