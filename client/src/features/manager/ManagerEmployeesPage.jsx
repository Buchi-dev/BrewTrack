import { EditOutlined, PlusOutlined, SearchOutlined, TeamOutlined, UserDeleteOutlined, UserSwitchOutlined } from '@ant-design/icons'
import { Alert, App, Button, Card, Col, Empty, Form, Input, Modal, Popconfirm, Row, Select, Space, Statistic, Table, Tag, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import {
  createEmployeeProfile,
  deactivateEmployeeProfile,
  getFullName,
  listEmployees,
  saveEmployeeProfile,
} from '../../services/manager/employeeService.js'

const { Text } = Typography
const PAGE_SIZE = 10
const initialEmployeeFilters = { page: 1, pageSize: PAGE_SIZE, search: '', status: null }
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'inactive', label: 'Inactive' },
]

const roleOptions = [
  { value: 'staff', label: 'Staff' },
  { value: 'manager', label: 'Manager' },
]

function getStatusColor(status) {
  if (status === 'active') return 'green'
  if (status === 'suspended') return 'gold'
  if (status === 'inactive') return 'default'
  return 'default'
}

export default function ManagerEmployeesPage() {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [rows, setRows] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deactivatingId, setDeactivatingId] = useState(null)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [filters, setFilters] = useState(initialEmployeeFilters)

  const employeeSummary = useMemo(
    () => ({
      total: count,
      activeVisible: rows.filter((employee) => employee.status === 'active').length,
      managerVisible: rows.filter((employee) => employee.role === 'manager').length,
      needsAttention: rows.filter((employee) => employee.status !== 'active').length,
    }),
    [count, rows],
  )

  async function loadData(nextFilters = filters) {
    setLoading(true)
    try {
      const employeeResult = await listEmployees(nextFilters)
      setRows(employeeResult.rows)
      setCount(employeeResult.count)
    } catch (error) {
      message.error(error.message || 'Unable to load employees.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      try {
        const employeeResult = await listEmployees(initialEmployeeFilters)
        if (!isMounted) return
        setRows(employeeResult.rows)
        setCount(employeeResult.count)
      } catch (error) {
        if (isMounted) message.error(error.message || 'Unable to load employees.')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadInitialData()

    return () => {
      isMounted = false
    }
  }, [message])

  function openEditor(employee = null) {
    setEditingEmployee(employee)
    setModalOpen(true)
    form.setFieldsValue({
      auth_user_id: employee?.id,
      first_name: employee?.first_name,
      middle_name: employee?.middle_name,
      last_name: employee?.last_name,
      employee_number: employee?.employee_number,
      phone: employee?.phone,
      role: employee?.role ?? 'staff',
      status: employee?.status ?? 'active',
    })
  }

  function closeEditor() {
    setModalOpen(false)
    setEditingEmployee(null)
    form.resetFields()
  }

  const columns = [
    {
      title: 'Employee',
      key: 'employee',
      render: (_, record) => (
        <div>
          <Text strong>{getFullName(record)}</Text>
          {record.phone && <div className="table-subtext">{record.phone}</div>}
        </div>
      ),
    },
    { title: 'Employee No.', dataIndex: 'employee_number', key: 'employeeNumber', responsive: ['md'] },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      responsive: ['lg'],
      render: (role) => <span className="text-capitalize">{role}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <Tag color={getStatusColor(status)}>{status}</Tag>,
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openEditor(record)}>
            Edit
          </Button>
          <Popconfirm
            title="Deactivate employee?"
            description="This keeps historical records intact and removes the employee from active staffing."
            okText="Deactivate"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDeactivate(record)}
            disabled={record.status === 'inactive'}
          >
            <Button
              danger
              icon={<UserDeleteOutlined />}
              loading={deactivatingId === record.id}
              disabled={record.status === 'inactive'}
            >
              Deactivate
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  function applyFilters(partial) {
    const nextFilters = { ...filters, page: 1, ...partial }
    setFilters(nextFilters)
    loadData(nextFilters)
  }

  async function handleSave() {
    const values = await form.validateFields()
    setSaving(true)
    try {
      if (editingEmployee) {
        await saveEmployeeProfile(editingEmployee.id, values)
        message.success('Employee updated.')
      } else {
        await createEmployeeProfile(values)
        message.success('Employee added.')
      }
      closeEditor()
      loadData(filters)
    } catch (error) {
      message.error(error.message || 'Unable to save employee.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(employee) {
    setDeactivatingId(employee.id)
    try {
      await deactivateEmployeeProfile(employee.id)
      message.success('Employee deactivated.')
      loadData(filters)
    } catch (error) {
      message.error(error.message || 'Unable to deactivate employee.')
    } finally {
      setDeactivatingId(null)
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
        title="Employees"
        description="Manage staff profiles, roles, and account status."
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>
            Add employee
          </Button>
        }
      />

      <Card>
        <Row gutter={[12, 12]} className="manager-summary-grid">
          <Col xs={12} md={6}>
            <Card size="small" className="manager-summary-card">
              <Statistic title="Employees" value={employeeSummary.total} prefix={<TeamOutlined />} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" className="manager-summary-card">
              <Statistic title="Active on page" value={employeeSummary.activeVisible} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" className="manager-summary-card">
              <Statistic title="Managers on page" value={employeeSummary.managerVisible} prefix={<UserSwitchOutlined />} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" className="manager-summary-card">
              <Statistic title="Review on page" value={employeeSummary.needsAttention} />
            </Card>
          </Col>
        </Row>

        <Alert
          className="manager-page-alert"
          type="info"
          showIcon
          title="Keep names, employee numbers, and account status tidy"
          description="These fields drive schedules, attendance filters, and reports, so small cleanup here makes every manager page easier to trust."
        />

        <Space wrap className="table-toolbar">
          <Input.Search
            prefix={<SearchOutlined />}
            placeholder="Search name or employee number"
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
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No employees match this view" />,
          }}
        />
      </Card>

      <Modal
        title={editingEmployee ? 'Edit employee' : 'Add employee'}
        open={modalOpen}
        onCancel={closeEditor}
        onOk={handleSave}
        confirmLoading={saving}
        okText={editingEmployee ? 'Save changes' : 'Add employee'}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          {!editingEmployee && (
            <Alert
              className="manager-page-alert"
              type="info"
              showIcon
              title="Use the Supabase Auth user id"
              description="Create or invite the user in Supabase Auth first, then paste that user's id here to manage their BrewTrack profile."
            />
          )}
          <Form.Item
            name="auth_user_id"
            label="Auth user id"
            rules={[
              { required: !editingEmployee, message: 'Enter the Supabase Auth user id.' },
              {
                validator: (_, value) => {
                  if (editingEmployee || !value || uuidPattern.test(value.trim())) return Promise.resolve()
                  return Promise.reject(new Error('Enter a valid UUID.'))
                },
              },
            ]}
          >
            <Input disabled={Boolean(editingEmployee)} placeholder="00000000-0000-0000-0000-000000000000" />
          </Form.Item>
          <Form.Item name="first_name" label="First name" rules={[{ required: true, message: 'Enter a first name.' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="middle_name" label="Middle name">
            <Input />
          </Form.Item>
          <Form.Item name="last_name" label="Last name" rules={[{ required: true, message: 'Enter a last name.' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="employee_number" label="Employee number">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true, message: 'Choose a role.' }]}>
            <Select options={roleOptions} />
          </Form.Item>
          <Form.Item name="status" label="Status" rules={[{ required: true, message: 'Choose a status.' }]}>
            <Select options={statusOptions} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
