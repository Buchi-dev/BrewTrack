import { EditOutlined, InfoCircleOutlined, PlusOutlined, SearchOutlined, TeamOutlined, UserSwitchOutlined } from '@ant-design/icons'
import { Alert, App, Button, Card, Col, Empty, Form, Input, Modal, Row, Select, Space, Statistic, Table, Tag, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import {
  getFullName,
  listEmployees,
  saveEmployeeProfile,
} from '../../services/manager/employeeService.js'

const { Text } = Typography
const PAGE_SIZE = 10
const initialEmployeeFilters = { page: 1, pageSize: PAGE_SIZE, search: '', status: null }

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
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [inviteOpen, setInviteOpen] = useState(false)
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

  function openEditor(employee) {
    setEditingEmployee(employee)
    form.setFieldsValue({
      first_name: employee.first_name,
      middle_name: employee.middle_name,
      last_name: employee.last_name,
      employee_number: employee.employee_number,
      phone: employee.phone,
      role: employee.role,
      status: employee.status,
    })
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
        <Button icon={<EditOutlined />} onClick={() => openEditor(record)}>
          Edit
        </Button>
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
      await saveEmployeeProfile(editingEmployee.id, values)
      message.success('Employee updated.')
      setEditingEmployee(null)
      form.resetFields()
      loadData(filters)
    } catch (error) {
      message.error(error.message || 'Unable to save employee.')
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
        title="Employees"
        description="Manage staff profiles, roles, and account status."
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setInviteOpen(true)}>
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
        title="Edit employee"
        open={Boolean(editingEmployee)}
        onCancel={() => setEditingEmployee(null)}
        onOk={handleSave}
        confirmLoading={saving}
        okText="Save changes"
      >
        <Form form={form} layout="vertical" requiredMark={false}>
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

      <Modal title="Add employee account" open={inviteOpen} onCancel={() => setInviteOpen(false)} footer={null}>
        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          title="Account creation needs a secure invite flow"
          description="This browser app should not hold Supabase admin credentials. For now, create the user in Supabase Auth with profile metadata, then manage the employee profile here. A secure invite function belongs in a later backend milestone."
        />
      </Modal>
    </>
  )
}
