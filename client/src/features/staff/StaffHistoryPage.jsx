import { CalendarOutlined, ClockCircleOutlined, EnvironmentOutlined, HistoryOutlined, ReloadOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Pagination, Space, Table, Tag, Typography } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import EmptyState from '../../components/EmptyState.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import { getStaffAttendanceHistory } from '../../services/attendanceService.js'
import { formatDate, formatTime } from '../../utils/date.js'

const { Text } = Typography

const STATUS_COLORS = {
  absent: 'default',
  completed: 'success',
  excused: 'blue',
  incomplete: 'processing',
  late: 'warning',
  present: 'success',
}

function formatStatus(status) {
  if (!status) return 'Unknown'
  return status.replaceAll('_', ' ')
}

function formatMinutes(value) {
  if (!Number.isFinite(value)) return '--'

  const hours = Math.floor(value / 60)
  const minutes = value % 60

  if (hours <= 0) return `${minutes}m`
  if (minutes <= 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

function getBranchName(record) {
  return record.branches?.name || record.branches?.code || '--'
}

export default function StaffHistoryPage() {
  const [records, setRecords] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState(null)

  const loadHistory = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)

    try {
      const result = await getStaffAttendanceHistory({ page, pageSize })
      setRecords(result.records)
      setTotal(result.total)
    } catch (error) {
      setErrorMessage(error.message || 'Unable to load attendance history.')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize])

  useEffect(() => {
    let active = true

    getStaffAttendanceHistory({ page, pageSize })
      .then((result) => {
        if (!active) return
        setRecords(result.records)
        setTotal(result.total)
        setErrorMessage(null)
      })
      .catch((error) => {
        if (!active) return
        setErrorMessage(error.message || 'Unable to load attendance history.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [page, pageSize])

  const columns = [
    {
      title: 'Date',
      dataIndex: 'attendance_date',
      key: 'attendance_date',
      render: (value) => formatDate(value),
    },
    {
      title: 'Station',
      key: 'branch',
      render: (_, record) => getBranchName(record),
    },
    {
      title: 'Clock in',
      dataIndex: 'clock_in_at',
      key: 'clock_in_at',
      render: (value) => formatTime(value),
    },
    {
      title: 'Clock out',
      dataIndex: 'clock_out_at',
      key: 'clock_out_at',
      render: (value) => formatTime(value),
    },
    {
      title: 'Late',
      dataIndex: 'late_minutes',
      key: 'late_minutes',
      render: (value) => formatMinutes(value),
    },
    {
      title: 'Worked',
      dataIndex: 'worked_minutes',
      key: 'worked_minutes',
      render: (value) => formatMinutes(value),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={STATUS_COLORS[status] ?? 'default'} className="text-capitalize">
          {formatStatus(status)}
        </Tag>
      ),
    },
  ]

  return (
    <div className="staff-history-page">
      <PageHeader
        eyebrow="History"
        title="My attendance history"
        description="Review your own previous clock-ins, clock-outs, late minutes, and completed shifts."
        actions={
          <Button icon={<ReloadOutlined />} onClick={loadHistory} loading={loading}>
            Refresh
          </Button>
        }
      />

      {errorMessage && (
        <Alert className="section-card" type="error" showIcon message={errorMessage} />
      )}

      <Card
        className="staff-history-records-card"
        title={<span className="staff-card-title"><HistoryOutlined /> Brew history</span>}
        extra={
          <Button icon={<ReloadOutlined />} onClick={loadHistory} loading={loading}>
            Refresh
          </Button>
        }
      >
        <Space direction="vertical" size="middle" className="full-width">
          <Text type="secondary" className="staff-history-policy-note">
            Showing records allowed by your account permissions. Staff records are protected by
            database policy.
          </Text>
          <div className="staff-history-mobile-list">
            {records.length ? (
              records.map((record) => (
                <Card key={record.id} className="staff-history-record-card">
                  <div className="staff-history-record-top">
                    <div>
                      <Text className="attendance-kicker">Shift</Text>
                      <Typography.Title level={3}>{formatDate(record.attendance_date)}</Typography.Title>
                    </div>
                    <Tag color={STATUS_COLORS[record.status] ?? 'default'} className="text-capitalize">
                      {formatStatus(record.status)}
                    </Tag>
                  </div>
                  <div className="staff-history-record-station">
                    <EnvironmentOutlined />
                    <Text>{getBranchName(record)}</Text>
                  </div>
                  <div className="staff-history-record-grid">
                    <div>
                      <Text type="secondary"><ClockCircleOutlined /> Clock in</Text>
                      <Text strong>{formatTime(record.clock_in_at)}</Text>
                    </div>
                    <div>
                      <Text type="secondary"><ClockCircleOutlined /> Clock out</Text>
                      <Text strong>{formatTime(record.clock_out_at)}</Text>
                    </div>
                    <div>
                      <Text type="secondary"><CalendarOutlined /> Late</Text>
                      <Text strong>{formatMinutes(record.late_minutes)}</Text>
                    </div>
                    <div>
                      <Text type="secondary"><CalendarOutlined /> Worked</Text>
                      <Text strong>{formatMinutes(record.worked_minutes)}</Text>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <EmptyState
                title="No attendance records yet"
                description="Completed clock-ins and clock-outs will appear here."
              />
            )}
            {total > pageSize && (
              <Pagination
                current={page}
                pageSize={pageSize}
                total={total}
                simple
                onChange={(nextPage) => {
                  setLoading(true)
                  setPage(nextPage)
                }}
              />
            )}
          </div>
          <Table
            className="staff-history-table"
            rowKey="id"
            columns={columns}
            dataSource={records}
            loading={loading}
            locale={{
              emptyText: (
                <EmptyState
                  title="No attendance records yet"
                  description="Completed clock-ins and clock-outs will appear here."
                />
              ),
            }}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50],
            }}
            scroll={{ x: 840 }}
            onChange={(nextPagination) => {
              setLoading(true)
              setPage(nextPagination.current || 1)
              setPageSize(nextPagination.pageSize || 10)
            }}
          />
        </Space>
      </Card>
    </div>
  )
}
