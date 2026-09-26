import { BankOutlined, EditOutlined, EnvironmentOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { Alert, App, Button, Card, Col, Empty, Form, Input, Modal, Row, Select, Space, Statistic, Switch, Table, Tag, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import { listBranches, saveBranch } from '../../services/manager/branchService.js'

const { Text } = Typography
const PAGE_SIZE = 10
const initialBranchFilters = { page: 1, pageSize: PAGE_SIZE, search: '', status: null }

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

export default function ManagerBranchesPage() {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [rows, setRows] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingBranch, setEditingBranch] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [filters, setFilters] = useState(initialBranchFilters)

  const stationSummary = useMemo(
    () => ({
      total: count,
      activeVisible: rows.filter((station) => station.is_active).length,
      inactiveVisible: rows.filter((station) => !station.is_active).length,
      missingAddress: rows.filter((station) => !station.address).length,
    }),
    [count, rows],
  )

  async function loadData(nextFilters = filters) {
    setLoading(true)
    try {
      const result = await listBranches(nextFilters)
      setRows(result.rows)
      setCount(result.count)
    } catch (error) {
      message.error(error.message || 'Unable to load stations.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      try {
        const result = await listBranches(initialBranchFilters)
        if (!isMounted) return
        setRows(result.rows)
        setCount(result.count)
      } catch (error) {
        if (isMounted) message.error(error.message || 'Unable to load stations.')
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

  function openEditor(branch = null) {
    setEditingBranch(branch)
    setModalOpen(true)
    form.setFieldsValue({
      name: branch?.name,
      code: branch?.code,
      address: branch?.address,
      is_active: branch?.is_active ?? true,
    })
  }

  const columns = [
    {
      title: 'Station',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div>
          <Text strong>{name}</Text>
          {record.address && <div className="table-subtext">{record.address}</div>}
        </div>
      ),
    },
    { title: 'Code', dataIndex: 'code', key: 'code', responsive: ['sm'] },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'status',
      render: (isActive) => <Tag color={isActive ? 'green' : 'default'}>{isActive ? 'active' : 'inactive'}</Tag>,
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, record) => (
        <Button icon={<EditOutlined />} onClick={() => openEditor(record)}>
          Edit
        </Button>
      ),
    },
  ]

  async function handleSave() {
    const values = await form.validateFields()
    setSaving(true)
    try {
      await saveBranch(values, editingBranch?.id)
      message.success(editingBranch ? 'Station updated.' : 'Station created.')
      setModalOpen(false)
      setEditingBranch(null)
      form.resetFields()
      loadData(filters)
    } catch (error) {
      message.error(error.message || 'Unable to save station.')
    } finally {
      setSaving(false)
    }
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

  return (
    <>
      <PageHeader
        eyebrow="Manager"
        title="Stations"
        description="Maintain station records and optional location verification settings."
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>
            Add station
          </Button>
        }
      />

      <Card>
        <Row gutter={[12, 12]} className="manager-summary-grid">
          <Col xs={12} md={6}>
            <Card size="small" className="manager-summary-card">
              <Statistic title="Stations" value={stationSummary.total} prefix={<BankOutlined />} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" className="manager-summary-card">
              <Statistic title="Active on page" value={stationSummary.activeVisible} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" className="manager-summary-card">
              <Statistic title="Inactive on page" value={stationSummary.inactiveVisible} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" className="manager-summary-card">
              <Statistic title="Missing address" value={stationSummary.missingAddress} prefix={<EnvironmentOutlined />} />
            </Card>
          </Col>
        </Row>

        <Alert
          className="manager-page-alert"
          type={stationSummary.missingAddress ? 'warning' : 'info'}
          showIcon
          title={
            stationSummary.missingAddress
              ? `${stationSummary.missingAddress} visible station${stationSummary.missingAddress === 1 ? '' : 's'} need an address`
              : 'Stations are the backbone of scheduling and attendance review'
          }
          description="Use clear station names and short codes so managers can scan schedules, reports, and clock-in records quickly."
        />

        <Space wrap className="table-toolbar">
          <Input.Search
            prefix={<SearchOutlined />}
            placeholder="Search stations"
            allowClear
            enterButton
            onSearch={(value) => applyFilters({ search: value })}
            style={{ minWidth: 280 }}
          />
          <Select
            placeholder="Status"
            allowClear
            options={statusOptions}
            value={filters.status}
            onChange={(value) => applyFilters({ status: value ?? null })}
            style={{ minWidth: 160 }}
          />
        </Space>
        <Table
          columns={columns}
          dataSource={rows}
          loading={loading}
          rowKey="id"
          pagination={{ current: filters.page, pageSize: filters.pageSize, total: count, showSizeChanger: true }}
          onChange={handleTableChange}
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No stations match this view" />,
          }}
        />
      </Card>

      <Modal
        title={editingBranch ? 'Edit station' : 'Add station'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText={editingBranch ? 'Save changes' : 'Create station'}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="name" label="Station name" rules={[{ required: true, message: 'Enter a station name.' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="code" label="Station code" rules={[{ required: true, message: 'Enter a station code.' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Address">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
