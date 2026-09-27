import { CopyOutlined, EditOutlined, KeyOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, TeamOutlined, UserDeleteOutlined, UserSwitchOutlined } from '@ant-design/icons'
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

function generateTemporaryPassword() {
  const groups = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789']
  const allCharacters = groups.join('')
  const randomIndex = (max) => {
    const values = new Uint32Array(1)
    crypto.getRandomValues(values)
    return values[0] % max
  }
  const password = groups.map((group) => group[randomIndex(group.length)])

  while (password.length < 12) {
    password.push(allCharacters[randomIndex(allCharacters.length)])
  }

  return password.sort(() => randomIndex(2) - 0.5).join('')
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
  const isEditing = Boolean(editingEmployee)

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
      email: '',
      temp_password: employee ? undefined : generateTemporaryPassword(),
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

  async function copyCredentials() {
    const { email, temp_password: tempPassword } = form.getFieldsValue(['email', 'temp_password'])
    if (!email || !tempPassword) {
      message.warning('Enter an email and temporary password first.')
      return
    }

    try {
      await navigator.clipboard.writeText(`Email: ${email}\nTemporary password: ${tempPassword}`)
      message.success('Login details copied.')
    } catch {
      message.error('Unable to copy login details.')
    }
  }

  function refreshTemporaryPassword() {
    form.setFieldValue('temp_password', generateTemporaryPassword())
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
        message.success('Employee account created. Send the email and temporary password to the staff.')
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
        className="employee-profile-modal"
        title={editingEmployee ? 'Edit employee' : 'Add employee'}
        open={modalOpen}
        onCancel={closeEditor}
        onOk={handleSave}
        confirmLoading={saving}
        okText={editingEmployee ? 'Save changes' : 'Add employee'}
        width={620}
      >
        <Form className="employee-profile-form" form={form} layout="vertical" requiredMark={false}>
          {!isEditing && (
            <div className="employee-credentials-panel">
              <Row gutter={[10, 8]}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="email"
                    label="Email"
                    rules={[
                      { required: true, message: 'Enter an email.' },
                      { type: 'email', message: 'Enter a valid email.' },
                    ]}
                  >
                    <Input autoComplete="off" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="temp_password"
                    label="Temporary password"
                    rules={[
                      { required: true, message: 'Generate or enter a temporary password.' },
                      { min: 8, message: 'Use at least 8 characters.' },
                      { pattern: /^[A-Za-z0-9]+$/, message: 'Use letters and numbers only.' },
                    ]}
                  >
                    <Input.Password autoComplete="new-password" prefix={<KeyOutlined />} />
                  </Form.Item>
                </Col>
              </Row>
              <Space wrap size={8}>
                <Button icon={<ReloadOutlined />} onClick={refreshTemporaryPassword}>
                  Generate
                </Button>
                <Button icon={<CopyOutlined />} onClick={copyCredentials}>
                  Copy login details
                </Button>
              </Space>
            </div>
          )}

          <Row gutter={[10, 0]}>
            <Col xs={24} md={12}>
              <Form.Item name="first_name" label="First name" rules={[{ required: true, message: 'Enter a first name.' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="last_name" label="Last name" rules={[{ required: true, message: 'Enter a last name.' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="middle_name" label="Middle name">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="employee_number" label="Employee number">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="phone" label="Phone">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="role" label="Role" rules={[{ required: true, message: 'Choose a role.' }]}>
                <Select options={roleOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="status" label="Status" rules={[{ required: true, message: 'Choose a status.' }]}>
                <Select options={statusOptions} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  )
}
