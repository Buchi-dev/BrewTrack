import { CalendarOutlined, EyeOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import { useEffect, useState } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import { listAuditLogs } from '../../services/manager/auditService.js'
import { getFullName } from '../../services/manager/employeeService.js'
import { formatDateTime } from '../../utils/date.js'

const { RangePicker } = DatePicker
const { Paragraph, Text } = Typography
const PAGE_SIZE = 10

const initialFilters = {
  page: 1,
  pageSize: PAGE_SIZE,
  search: '',
  action: null,
  resourceType: null,
  startDate: null,
  endDate: null,
}

const actionOptions = [
  { value: 'profiles_updated', label: 'Profile updated' },
  { value: 'branches_created', label: 'Branch created' },
  { value: 'branches_updated', label: 'Branch updated' },
  { value: 'branches_deleted', label: 'Branch deleted' },
  { value: 'employee_branches_created', label: 'Branch assignment created' },
  { value: 'employee_branches_updated', label: 'Branch assignment updated' },
  { value: 'employee_branches_deleted', label: 'Branch assignment deleted' },
  { value: 'app_settings_updated', label: 'Settings updated' },
  { value: 'report_exported', label: 'Report exported' },
]

const resourceOptions = [
  { value: 'profiles', label: 'Profiles' },
  { value: 'branches', label: 'Branches' },
  { value: 'employee_branches', label: 'Branch assignments' },
  { value: 'app_settings', label: 'Settings' },
  { value: 'reports', label: 'Reports' },
]

function formatLabel(value) {
  return value?.replaceAll('_', ' ') || '--'
}

function formatJson(value) {
  if (value == null) return '--'
  return JSON.stringify(value, null, 2)
}

function getActionColor(action) {
  if (action?.includes('created')) return 'green'
  if (action?.includes('deleted')) return 'red'
  if (action?.includes('exported')) return 'blue'
  return 'gold'
}

function toDateFilterValue(value) {
  return value ? value.format('YYYY-MM-DD') : null
}

function AuditJsonBlock({ title, value }) {
  return (
    <div className="audit-json-block">
      <Text strong>{title}</Text>
      <Paragraph className="audit-json" copyable={value != null}>
        {formatJson(value)}
      </Paragraph>
    </div>
  )
}

export default function ManagerAuditPage() {
  const { message } = App.useApp()
  const [rows, setRows] = useState([])
  const [count, setCount] = useState(0)
  const [filters, setFilters] = useState(initialFilters)
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState(null)

  async function loadData(nextFilters = filters) {
    setLoading(true)
    try {
      const result = await listAuditLogs(nextFilters)
      setRows(result.rows)
      setCount(result.count)
    } catch (error) {
      message.error(error.message || 'Unable to load audit logs.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      try {
        const result = await listAuditLogs(initialFilters)
        if (!isMounted) return
        setRows(result.rows)
        setCount(result.count)
      } catch (error) {
        if (isMounted) message.error(error.message || 'Unable to load audit logs.')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadInitialData()

    return () => {
      isMounted = false
    }
  }, [message])

  function applyFilters(partial) {
    const nextFilters = { ...filters, page: 1, ...partial }
    setFilters(nextFilters)
    loadData(nextFilters)
  }

  function resetFilters() {
    setFilters(initialFilters)
    loadData(initialFilters)
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
      title: 'When',
      dataIndex: 'created_at',
      key: 'createdAt',
      render: (value) => formatDateTime(value),
    },
    {
      title: 'Actor',
      dataIndex: 'profiles',
      key: 'actor',
      render: (profile) => (
        <div>
          <Text strong>{profile ? getFullName(profile) : 'System'}</Text>
          {profile?.employee_number && <div className="table-subtext">{profile.employee_number}</div>}
        </div>
      ),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: (value) => <Tag color={getActionColor(value)}>{formatLabel(value)}</Tag>,
    },
    {
      title: 'Resource',
      key: 'resource',
      responsive: ['md'],
      render: (_, record) => (
        <div>
          <Text>{formatLabel(record.resource_type)}</Text>
          {record.resource_id && <div className="table-subtext">{record.resource_id}</div>}
        </div>
      ),
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, record) => (
        <Button icon={<EyeOutlined />} onClick={() => setSelectedLog(record)}>
          Details
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Manager"
        title="Audit logs"
        description="Review manager actions and system-generated administrative history."
        actions={
          <Button icon={<ReloadOutlined />} onClick={() => loadData(filters)} loading={loading}>
            Refresh
          </Button>
        }
      />

      <Card>
        <Space wrap className="table-toolbar">
          <Input.Search
            prefix={<SearchOutlined />}
            placeholder="Action or resource"
            allowClear
            enterButton
            onSearch={(value) => applyFilters({ search: value })}
            style={{ minWidth: 260 }}
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
            placeholder="Action"
            allowClear
            showSearch
            optionFilterProp="label"
            options={actionOptions}
            value={filters.action}
            onChange={(value) => applyFilters({ action: value ?? null })}
            style={{ minWidth: 220 }}
          />
          <Select
            placeholder="Resource"
            allowClear
            options={resourceOptions}
            value={filters.resourceType}
            onChange={(value) => applyFilters({ resourceType: value ?? null })}
            style={{ minWidth: 190 }}
          />
          <Button onClick={resetFilters}>Reset</Button>
        </Space>

        <Table
          columns={columns}
          dataSource={rows}
          loading={loading}
          rowKey="id"
          scroll={{ x: 900 }}
          pagination={{ current: filters.page, pageSize: filters.pageSize, total: count, showSizeChanger: true }}
          onChange={handleTableChange}
        />
      </Card>

      <Drawer
        title="Audit log details"
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        width={760}
      >
        <Space direction="vertical" size={18} className="full-width">
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Action">{formatLabel(selectedLog?.action)}</Descriptions.Item>
            <Descriptions.Item label="Actor">
              {selectedLog?.profiles ? getFullName(selectedLog.profiles) : 'System'}
            </Descriptions.Item>
            <Descriptions.Item label="Resource">{formatLabel(selectedLog?.resource_type)}</Descriptions.Item>
            <Descriptions.Item label="Resource ID">{selectedLog?.resource_id || '--'}</Descriptions.Item>
            <Descriptions.Item label="Created">{formatDateTime(selectedLog?.created_at)}</Descriptions.Item>
          </Descriptions>

          <AuditJsonBlock title="Previous values" value={selectedLog?.old_values} />
          <AuditJsonBlock title="New values" value={selectedLog?.new_values} />
          <AuditJsonBlock title="Metadata" value={selectedLog?.metadata} />
        </Space>
      </Drawer>
    </>
  )
}
