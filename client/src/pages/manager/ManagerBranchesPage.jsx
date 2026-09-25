import { EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { App, Button, Card, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tag, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { listBranches, saveBranch } from '../../services/managerService.js'
import PageHeader from '../shared/PageHeader.jsx'

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

  async function loadData(nextFilters = filters) {
    setLoading(true)
    try {
      const result = await listBranches(nextFilters)
      setRows(result.rows)
      setCount(result.count)
    } catch (error) {
      message.error(error.message || 'Unable to load branches.')
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
        if (isMounted) message.error(error.message || 'Unable to load branches.')
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
      timezone: branch?.timezone || 'Asia/Manila',
      geofence_radius: branch?.geofence_radius ?? 0,
      latitude: branch?.latitude,
      longitude: branch?.longitude,
      is_active: branch?.is_active ?? true,
    })
  }

  const columns = [
    {
      title: 'Branch',
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
    { title: 'Timezone', dataIndex: 'timezone', key: 'timezone', responsive: ['md'] },
    {
      title: 'Geofence',
      dataIndex: 'geofence_radius',
      key: 'geofence',
      responsive: ['lg'],
      render: (radius) => (radius > 0 ? `${radius} m` : 'Off'),
    },
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
      message.success(editingBranch ? 'Branch updated.' : 'Branch created.')
      setModalOpen(false)
      setEditingBranch(null)
      form.resetFields()
      loadData(filters)
    } catch (error) {
      message.error(error.message || 'Unable to save branch.')
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
        title="Branches"
        description="Maintain branch records and optional location verification settings."
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>
            Add branch
          </Button>
        }
      />

      <Card>
        <Space wrap className="table-toolbar">
          <Input.Search
            prefix={<SearchOutlined />}
            placeholder="Search branches"
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
        />
      </Card>

      <Modal
        title={editingBranch ? 'Edit branch' : 'Add branch'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText={editingBranch ? 'Save changes' : 'Create branch'}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="name" label="Branch name" rules={[{ required: true, message: 'Enter a branch name.' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="code" label="Branch code" rules={[{ required: true, message: 'Enter a branch code.' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Address">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="timezone" label="Timezone" rules={[{ required: true, message: 'Enter a timezone.' }]}>
            <Input />
          </Form.Item>
          <Space className="form-grid-two" align="start">
            <Form.Item name="latitude" label="Latitude">
              <InputNumber min={-90} max={90} precision={6} className="full-width" />
            </Form.Item>
            <Form.Item name="longitude" label="Longitude">
              <InputNumber min={-180} max={180} precision={6} className="full-width" />
            </Form.Item>
          </Space>
          <Form.Item name="geofence_radius" label="Geofence radius in meters">
            <InputNumber min={0} precision={0} className="full-width" />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
